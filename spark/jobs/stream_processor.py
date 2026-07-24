from pyspark.sql import SparkSession
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, TimestampType
from pyspark.sql.functions import from_json
import time

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
        # Spark le calculera lui-même à l'Étape suivante (détection d'anomalie).
        StructField("quality_score", DoubleType(), True),
        StructField("battery_level", DoubleType(), True),
        StructField("signal_strength", DoubleType(), True),
        StructField("metadata", metadata_schema, True),
    ])
    
    # On détruit le bloc de texte pour en faire de vraies colonnes
    # (On ne garde que les données propres 'data.*')
    df_parsed = df_string.withColumn("data", from_json("value", json_schema)) \
                         .select("data.*")
        
    # Étape 2 : Écriture dans la base de données MongoDB
    print("Démarrage du flux vers MongoDB...")
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
