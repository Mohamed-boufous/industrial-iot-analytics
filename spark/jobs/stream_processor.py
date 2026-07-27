from pyspark.sql import SparkSession
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, TimestampType
from pyspark.sql.functions import from_json, col, when
import time

# ══════════════════════════════════════════════════════════════════════════════
# SINGLE SOURCE OF TRUTH : Seuils d'Anomalie par Type de Capteur
# ══════════════════════════════════════════════════════════════════════════════
# Ces seuils sont définis ici UNE SEULE FOIS. Si on veut ajuster un seuil
# (ex: rendre l'alerte température plus stricte), on change uniquement ici.
# Le reste du code s'adapte automatiquement.
#
# Contexte : Plateforme industrielle AzurA, Agadir, Maroc
#   - Températures ambiantes élevées (25-40°C en été à Agadir)
#   - Machines industrielles (fabriques, entrepôts, zone portuaire)
#   - Seuils reflètent les normes industrielles IEC/ISO pour ce type de site
# ══════════════════════════════════════════════════════════════════════════════
SENSOR_THRESHOLDS = {
    # Température (°C) - Capteurs sur machines industrielles
    # Normal : 20-80°C (chauffage machine accepté en zone industrielle chaude)
    # TROP FROID < 5°C  : risque de gel des équipements la nuit en hiver à Agadir
    # TROP CHAUD > 80°C : surchauffe machine, risque d'incendie
    "temperature": {"min": 5.0,   "max": 80.0},

    # Vibration (mm/s) - Capteurs sur moteurs et turbines
    # Normal : 0-5 mm/s (norme ISO 10816 pour machines industrielles)
    # TROP BAS < 0 mm/s  : physiquement impossible (valeur absolue)
    # TROP HAUT > 5 mm/s : déséquilibre rotor, risque de casse
    "vibration":   {"min": 0.0,   "max": 5.0},

    # Pression (bar) - Capteurs sur conduites et cuves
    # Normal : 1-10 bar
    # TROP BAS < 1 bar   : fuite de pression, risque de cavitation dans les pompes
    # TROP HAUT > 10 bar : surpression, risque d'explosion de conduite
    "pression":    {"min": 1.0,   "max": 10.0},

    # Humidité (%) - Capteurs dans entrepôts et zones de stockage
    # Normal : 30-70%
    # TROP SEC < 30%     : risque d'électricité statique (dangereux pour les composants)
    # TROP HUMIDE > 70%  : risque de moisissures, corrosion des équipements
    "humidite":    {"min": 30.0,  "max": 70.0},

    # Consommation électrique (kW) - Capteurs sur transformateurs
    # Normal : 100-500 kW
    # TROP BAS < 100 kW  : équipement probablement hors service (panne silencieuse)
    # TROP HAUT > 500 kW : surcharge électrique, risque de disjonction générale
    "consommation": {"min": 100.0, "max": 500.0},

    # Batterie (%) - Commune à tous les capteurs
    "battery":     {"min": 15.0,  "max": 100.0},
}

def create_spark_session():
    """
    Initialise et retourne une SparkSession configurée pour notre projet AzurA.
    """
    spark = SparkSession.builder \
        .appName("AzurA-Streaming") \
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
        .option("startingOffsets", "latest") \
        .load()
        
    # Étape 1.1 : Traduction du Binaire vers Texte (Casting)
    print("Conversion des données binaires en texte...")
    df_string = df_raw.selectExpr("CAST(value AS STRING)")
        
    # Étape 1.2 : Parsing du JSON (Création de colonnes)
    print("Définition du schéma et parsing du JSON...")
    
    # On dessine le "plan" COMPLET de notre donnée IoT
    # Avant : seulement 5 champs capturés sur 11 → 6 champs perdus !
    # Après  : 11 champs capturés, dont l'objet "metadata" imbriqué
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
        # NOTE: 'status' n'est PAS lu depuis Kafka.
        # Spark le calculera lui-même à l'Étape 1.3 (détection d'anomalie).
        StructField("quality_score", DoubleType(), True),
        StructField("battery_level", DoubleType(), True),
        StructField("signal_strength", DoubleType(), True),
        StructField("metadata", metadata_schema, True),
    ])
    
    # On détruit le bloc de texte pour en faire de vraies colonnes
    # (On ne garde que les données propres 'data.*')
    df_parsed = df_string.withColumn("data", from_json("value", json_schema)) \
                         .select("data.*")

    # ──────────────────────────────────────────────────────────────────────
    # Étape 1.3 : Détection d'Anomalies en Temps Réel (Calcul du 'status')
    # ──────────────────────────────────────────────────────────────────────
    # Spark analyse chaque relevé et attribue un statut selon le type de
    # capteur et les seuils définis dans SENSOR_THRESHOLDS (en haut du fichier).
    # On applique des bornes MIN et MAX pour chaque type de capteur.
    # Les seuils sont lus depuis SENSOR_THRESHOLDS (Single Source of Truth).
    # ──────────────────────────────────────────────────────────────────────
    print("Application des règles de détection d'anomalies...")

    t  = SENSOR_THRESHOLDS  # Alias court pour lisibilité

    df_with_status = df_parsed.withColumn(
        "status",
        # Température : trop froide (gel équipements) ou trop chaude (surchauffe)
        when((col("device_type") == "temperature") & (col("value") < t["temperature"]["min"]), "CRITICAL_TEMP_LOW")
        .when((col("device_type") == "temperature") & (col("value") > t["temperature"]["max"]), "CRITICAL_TEMP_HIGH")
        # Vibration : une valeur négative est physiquement impossible
        .when((col("device_type") == "vibration")   & (col("value") < t["vibration"]["min"]),   "CRITICAL_VIB_LOW")
        .when((col("device_type") == "vibration")   & (col("value") > t["vibration"]["max"]),   "CRITICAL_VIB_HIGH")
        # Pression : sous-pression (fuite) ou surpression (explosion)
        .when((col("device_type") == "pression")    & (col("value") < t["pression"]["min"]),    "CRITICAL_PRES_LOW")
        .when((col("device_type") == "pression")    & (col("value") > t["pression"]["max"]),    "CRITICAL_PRES_HIGH")
        # Humidité : trop sèche (électricité statique) ou trop humide (corrosion)
        .when((col("device_type") == "humidite")    & (col("value") < t["humidite"]["min"]),    "CRITICAL_HUM_LOW")
        .when((col("device_type") == "humidite")    & (col("value") > t["humidite"]["max"]),    "CRITICAL_HUM_HIGH")
        # Consommation : trop faible (panne silencieuse) ou surcharge électrique
        .when((col("device_type") == "consommation") & (col("value") < t["consommation"]["min"]), "CRITICAL_POW_LOW")
        .when((col("device_type") == "consommation") & (col("value") > t["consommation"]["max"]), "CRITICAL_POW_HIGH")
        # Batterie faible : applicable à TOUS les types de capteurs
        .when(col("battery_level") < t["battery"]["min"], "LOW_BATTERY")
        # Par défaut : fonctionnement dans les plages normales
        .otherwise("NORMAL")
    )
        
    # ──────────────────────────────────────────────────────────────────────
    # Étape 2 : Écriture des DONNÉES BRUTES dans MongoDB
    # ──────────────────────────────────────────────────────────────────────
    # On écrit df_parsed (données brutes sans status) dans MongoDB.
    # Le status calculé (df_with_status) sera envoyé vers Kafka iot-alerts
    # à l'étape suivante (Étape 3, prochaine tâche).
    # Architecture : MongoDB = stockage brut / Kafka = transport des alertes
    # ──────────────────────────────────────────────────────────────────────
    print("Démarrage du flux vers MongoDB (données brutes)...")
    query = df_parsed.writeStream \
        .format("mongodb") \
        .option("spark.mongodb.connection.uri", "mongodb://mongos-router:27017") \
        .option("spark.mongodb.database", "azura_iot") \
        .option("spark.mongodb.collection", "raw_measurements") \
        .option("checkpointLocation", "/opt/spark/checkpoints/iot-raw-data-mongo") \
        .outputMode("append") \
        .start()
        
    # On bloque le programme pour qu'il écoute indéfiniment
    query.awaitTermination()

