import os
import json
import time
import urllib.request
from pyspark.sql import SparkSession
from pyspark.sql.types import StructType, StructField, StringType, DoubleType
from pyspark.sql.functions import from_json, struct, col, when

# ══════════════════════════════════════════════════════════════════════════════
# SINGLE SOURCE OF TRUTH : Seuils d'Anomalie Dynamiques (MongoDB / FastAPI)
# ══════════════════════════════════════════════════════════════════════════════
SENSOR_THRESHOLDS_DEFAULT = {
    "temperature":   {"min": 5.0,   "max": 80.0},
    "vibration":     {"min": 0.0,   "max": 5.0},
    "pression":      {"min": 1.0,   "max": 10.0},
    "humidite":      {"min": 30.0,  "max": 70.0},
    "consommation":  {"min": 100.0, "max": 500.0},
    "battery":       {"min": 20.0,  "max": 100.0}
}

_cached_thresholds = None
_last_fetch_time = 0.0

def get_dynamic_thresholds() -> dict:
    """
    Récupère en temps réel les seuils définis dans MongoDB (via FastAPI /api/settings/thresholds).
    Cache en mémoire avec rafraîchissement automatique toutes les 2.0 secondes.
    """
    global _cached_thresholds, _last_fetch_time
    now = time.time()
    if _cached_thresholds is None or (now - _last_fetch_time > 2.0):
        try:
            req = urllib.request.Request(
                "http://azura-api:8000/api/settings/thresholds",
                headers={"User-Agent": "SparkStructuredStreamingEngine"}
            )
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if "thresholds" in data:
                    _cached_thresholds = {
                        k: {"min": float(v["min"]), "max": float(v["max"])}
                        for k, v in data["thresholds"].items()
                    }
                    _last_fetch_time = now
                    print(f"[Spark Dynamic] 🔄 Seuils recharges depuis MongoDB (Pression Max: {_cached_thresholds.get('pression', {}).get('max')})")
                    return _cached_thresholds
        except Exception as e:
            pass
            
    return _cached_thresholds or SENSOR_THRESHOLDS_DEFAULT

def create_spark_session():
    """Initialise la SparkSession optimisée pour le streaming."""
    spark = SparkSession.builder \
        .appName("AzurA-Streaming-Processor") \
        .config("spark.sql.shuffle.partitions", "4") \
        .getOrCreate()
    spark.sparkContext.setLogLevel("WARN")
    return spark

def process_micro_batch(batch_df, batch_id):
    """
    Fonction exécutée à chaque micro-lot de streaming (Driver).
    Applique dynamiquement les seuils à jour sans aucun redémarrage nécessaire.
    """
    if batch_df.rdd.isEmpty():
        return

    # 1. Chargement dynamique des seuils à jour
    t = get_dynamic_thresholds()

    # 2. Évaluation vectorisée Catalyst du statut
    df_with_status = batch_df.withColumn(
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

    # 3. Écriture MongoDB raw_measurements (données brutes horodatées)
    df_with_status.write \
        .format("mongodb") \
        .option("spark.mongodb.connection.uri", "mongodb://mongos-router:27017") \
        .option("spark.mongodb.database", "azura_iot") \
        .option("spark.mongodb.collection", "raw_measurements") \
        .mode("append") \
        .save()

    # 4. Publication Kafka 'iot-processed' (Toutes les mesures enrichies du statut calculé)
    df_processed = df_with_status.selectExpr(
        "CAST(device_id AS STRING) AS key",
        "to_json(struct(*)) AS value"
    )
    df_processed.write \
        .format("kafka") \
        .option("kafka.bootstrap.servers", "kafka1:19092,kafka2:19092,kafka3:19092") \
        .option("topic", "iot-processed") \
        .save()

    # 5. Publication Kafka 'iot-alerts' (Uniquement les anomalies status != 'NORMAL')
    df_alerts = df_with_status.filter(col("status") != "NORMAL") \
                              .selectExpr("CAST(device_id AS STRING) AS key", "to_json(struct(*)) AS value")
    
    if not df_alerts.rdd.isEmpty():
        df_alerts.write \
            .format("kafka") \
            .option("kafka.bootstrap.servers", "kafka1:19092,kafka2:19092,kafka3:19092") \
            .option("topic", "iot-alerts") \
            .save()

if __name__ == "__main__":
    print("--- Démarrage du Spark Structured Streaming Engine (Dynamique) ---")
    spark = create_spark_session()
    
    # Schéma de décodage des messages IoT
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

    # Lecture continue depuis Kafka 'iot-raw-data'
    df_raw = spark.readStream \
        .format("kafka") \
        .option("kafka.bootstrap.servers", "kafka1:19092,kafka2:19092,kafka3:19092") \
        .option("subscribe", "iot-raw-data") \
        .option("kafka.group.id", "spark-azura-group") \
        .option("startingOffsets", "latest") \
        .load()

    df_parsed = df_raw.selectExpr("CAST(value AS STRING) as json_str") \
                      .select(from_json("json_str", json_schema).alias("data")) \
                      .select("data.*")

    # Démarrage du pipeline avec foreachBatch pour application dynamique des seuils à chaque micro-lot
    query = df_parsed.writeStream \
        .foreachBatch(process_micro_batch) \
        .option("checkpointLocation", "/opt/spark/checkpoints/dynamic-processor") \
        .start()

    print("[✓ Spark] Streaming Query démarrée avec succès avec seuils dynamiques !")
    query.awaitTermination()
