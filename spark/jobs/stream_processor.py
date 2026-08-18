import os
from pyspark.sql import SparkSession
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, TimestampType
from pyspark.sql.functions import from_json, to_json, struct, col, when
import time

# ══════════════════════════════════════════════════════════════════════════════
# SINGLE SOURCE OF TRUTH : Seuils d'Anomalie Centralisés dans MongoDB
# ══════════════════════════════════════════════════════════════════════════════
SENSOR_THRESHOLDS_DEFAULT = {
    "temperature":   {"min": 5.0,   "max": 80.0},
    "vibration":     {"min": 0.0,   "max": 5.0},
    "pression":      {"min": 1.0,   "max": 10.0},
    "humidite":      {"min": 30.0,  "max": 70.0},
    "consommation":  {"min": 100.0, "max": 500.0},
    "battery":       {"min": 20.0,  "max": 100.0}
}

def load_thresholds_from_mongodb() -> dict:
    """Charge les seuils depuis la collection system_configuration de MongoDB (Single Source of Truth)."""
    try:
        from pymongo import MongoClient
        mongo_uri = os.environ.get("MONGO_URI", "mongodb://mongos-router:27017")
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=4000)
        doc = client["azura_iot"]["system_configuration"].find_one({"_id": "thresholds_config"})
        if doc and "thresholds" in doc:
            t = doc["thresholds"]
            print("[Spark] ✅ Seuils charges dynamiquement depuis MongoDB 'system_configuration' !")
            return {
                k: {"min": float(v["min"]), "max": float(v["max"])}
                for k, v in t.items()
            }
    except Exception as e:
        print(f"[Spark] ⚠️ Impossible de lire les seuils depuis MongoDB ({e}), utilisation des valeurs par defaut.")
    return SENSOR_THRESHOLDS_DEFAULT

SENSOR_THRESHOLDS = load_thresholds_from_mongodb()

def create_spark_session():
    """
    Initialise et retourne une SparkSession configurée pour notre projet AzurA.
    """
    spark = SparkSession.builder \
        .appName("AzurA-Streaming") \
        .config("spark.sql.shuffle.partitions", "6") \
        .getOrCreate()
        
    # On réduit le niveau de logs pour ne pas polluer la console avec des informations inutiles
    spark.sparkContext.setLogLevel("WARN")
    
    return spark

if __name__ == "__main__":
    print("Initialisation de la SparkSession...")
    spark = create_spark_session()
    print("SparkSession créée avec succès !")
    
    # Étape 1 : Lecture depuis Kafka (Source)
    print("Connexion au topic Kafka 'iot-raw-data'...")
    df_raw = spark.readStream \
        .format("kafka") \
        .option("kafka.bootstrap.servers", "kafka1:19092,kafka2:19092,kafka3:19092") \
        .option("subscribe", "iot-raw-data") \
        .option("kafka.group.id", "spark-azura-group") \
        .option("startingOffsets", "earliest") \
        .load()
        
    # Étape 1.1 : Traduction du Binaire vers Texte (Casting)
    print("Conversion des données binaires en texte...")
    df_string = df_raw.selectExpr("CAST(value AS STRING)")
        
    # Étape 1.2 : Parsing du JSON (Création de colonnes)
    print("Définition du schéma et parsing du JSON...")
    
    metadata_schema = StructType([
        StructField("manufacturer", StringType(), True),
        StructField("model", StringType(), True),
        StructField("firmware_version", StringType(), True),
        StructField("calibration_date", StringType(), True),
    ])


    json_schema = StructType([
        StructField("device_id", StringType(), True),
        StructField("device_type", StringType(), True),
        StructField("location", StringType(), True),
        StructField("timestamp", StringType(), True),
        StructField("value", DoubleType(), True),
        StructField("unit", StringType(), True),
        StructField("quality_score", DoubleType(), True),
        StructField("battery_level", DoubleType(), True),
        StructField("signal_strength", DoubleType(), True),
        StructField("metadata", metadata_schema, True),
    ])
    
    df_parsed = df_string.withColumn("data", from_json("value", json_schema)) \
                         .select("data.*")

    # ──────────────────────────────────────────────────────────────────────
    # Étape 1.3 : Détection d'Anomalies en Temps Réel (Calcul du 'status')
    # ──────────────────────────────────────────────────────────────────────
    print("Application des règles de détection d'anomalies...")

    t = SENSOR_THRESHOLDS  # Alias court pour lisibilité

    df_with_status = df_parsed.withColumn(
        "status",
        when((col("device_type") == "temperature") & (col("value") < t["temperature"]["min"]), "CRITICAL_TEMP_LOW")
        .when((col("device_type") == "temperature") & (col("value") > t["temperature"]["max"]), "CRITICAL_TEMP_HIGH")
        .when((col("device_type") == "vibration")   & (col("value") < t["vibration"]["min"]),   "CRITICAL_VIB_LOW")
        .when((col("device_type") == "vibration")   & (col("value") > t["vibration"]["max"]),   "CRITICAL_VIB_HIGH")
        .when((col("device_type") == "pression")    & (col("value") < t["pression"]["min"]),    "CRITICAL_PRES_LOW")
        .when((col("device_type") == "pression")    & (col("value") > t["pression"]["max"]),    "CRITICAL_PRES_HIGH")
        .when((col("device_type") == "humidite")    & (col("value") < t["humidite"]["min"]),    "CRITICAL_HUM_LOW")
        .when((col("device_type") == "humidite")    & (col("value") > t["humidite"]["max"]),    "CRITICAL_HUM_HIGH")
        .when((col("device_type") == "consommation") & (col("value") < t["consommation"]["min"]), "CRITICAL_POW_LOW")
        .when((col("device_type") == "consommation") & (col("value") > t["consommation"]["max"]), "CRITICAL_POW_HIGH")
        .when(col("battery_level") < t["battery"]["min"], "LOW_BATTERY")
        .otherwise("NORMAL")
    )
        
    # ──────────────────────────────────────────────────────────────────────
    # Étape 2 : Écriture des DONNÉES BRUTES dans MongoDB
    # ──────────────────────────────────────────────────────────────────────
    print("Démarrage du flux vers MongoDB (données brutes)...")
    query_mongo = df_parsed.writeStream \
        .format("mongodb") \
        .option("spark.mongodb.connection.uri", "mongodb://mongos-router:27017") \
        .option("spark.mongodb.database", "azura_iot") \
        .option("spark.mongodb.collection", "raw_measurements") \
        .option("checkpointLocation", "/opt/spark/checkpoints/iot-raw-data-mongo") \
        .outputMode("append") \
        .start()

    # ──────────────────────────────────────────────────────────────────────
    # Étape 3 : Filtrer et Publier les ALERTES EN TEMPS RÉEL dans Kafka
    # ──────────────────────────────────────────────────────────────────────
    # On isole uniquement les anomalies (status != NORMAL) et on les envoie
    # vers le topic Kafka 'iot-alerts' au format JSON.
    # ──────────────────────────────────────────────────────────────────────
    print("Démarrage du flux d'alertes vers Kafka (topic: iot-alerts)...")
    df_alerts = df_with_status.filter(col("status") != "NORMAL")

    # Kafka attend deux colonnes : 'key' (optionnel) et 'value' (au format JSON)
    df_alerts_json = df_alerts.selectExpr(
        "CAST(device_id AS STRING) AS key",
        "to_json(struct(*)) AS value"
    )

    query_alerts = df_alerts_json.writeStream \
        .format("kafka") \
        .option("kafka.bootstrap.servers", "kafka1:19092,kafka2:19092,kafka3:19092") \
        .option("topic", "iot-alerts") \
        .option("checkpointLocation", "/opt/spark/checkpoints/iot-alerts-kafka") \
        .outputMode("append") \
        .start()
    print("Démarrage du flux d'iots vers Kafka (topic: iot-processed)...")
    df_processed_json=df_with_status.selectExpr(
        "CAST(device_id AS STRING) AS key",
        "to_json(struct(*)) AS value"
    )
    query_processed = df_processed_json.writeStream \
        .format("kafka") \
        .option("kafka.bootstrap.servers", "kafka1:19092,kafka2:19092,kafka3:19092") \
        .option("topic", "iot-processed") \
        .option("checkpointLocation", "/opt/spark/checkpoints/iot-processed-kafka") \
        .outputMode("append") \
        .start()
    # On maintient la SparkSession active pour les 3 requêtes simultanées (MongoDB, iot-alerts, iot-processed)
    spark.streams.awaitAnyTermination()


