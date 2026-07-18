from pyspark.sql import SparkSession
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
        
    # Étape 2 : Écriture dans la console (Sink de test)
    print("Démarrage du flux vers la console...")
    query = df_raw.writeStream \
        .format("console") \
        .outputMode("append") \
        .option("checkpointLocation", "/opt/spark/checkpoints/iot-raw-data") \
        .start()
        
    # On bloque le programme pour qu'il écoute indéfiniment
    query.awaitTermination()
