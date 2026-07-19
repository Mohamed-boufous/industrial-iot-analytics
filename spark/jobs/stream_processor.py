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
    
    # On dessine le "plan" corrigé de notre donnée IoT
    json_schema = StructType([
        StructField("device_id", StringType(), True),
        StructField("device_type", StringType(), True),
        StructField("value", DoubleType(), True),
        StructField("unit", StringType(), True),
        StructField("timestamp", StringType(), True) 
    ])
    
    # On détruit le bloc de texte pour en faire de vraies colonnes
    # (On ne garde que les données propres 'data.*')
    df_parsed = df_string.withColumn("data", from_json("value", json_schema)) \
                         .select("data.*")
        
    # Étape 2 : Écriture dans la console (Sink de test)
    print("Démarrage du flux vers la console...")
    query = df_parsed.writeStream \
        .format("console") \
        .outputMode("append") \
        .option("truncate", False) \
        .option("checkpointLocation", "/opt/spark/checkpoints/iot-raw-data") \
        .start()
        
    # On bloque le programme pour qu'il écoute indéfiniment
    query.awaitTermination()
