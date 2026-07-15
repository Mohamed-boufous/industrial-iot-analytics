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
    
    # On met le programme en pause (10 minutes) pour laisser le temps de vérifier l'interface web
    print("En attente... Vous pouvez aller vérifier l'interface Spark UI.")
    time.sleep(600)
