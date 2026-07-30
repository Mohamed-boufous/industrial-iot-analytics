# industrial-iot-analytics — Plateforme de Streaming IoT Industriel en Temps Réel

> Plateforme Big Data complète pour la surveillance, le traitement et le stockage de données industrielles IoT en temps réel — conçue avec une architecture de haute disponibilité professionnelle.

---

## Vue d'Ensemble

**Azura industrial-iot-analytics** est une plateforme de streaming IoT industriel qui simule, transporte, traite et stocke des données de capteurs en temps réel. Le projet est inspiré d'un scénario réel : la surveillance d'installations agricoles et industrielles au Maroc (Agadir, Dakhla, Tanger, Casablanca, Kénitra).

La plateforme repose sur trois couches principales :

| Couche | Technologie | Rôle |
|--------|-------------|------|
| **Ingestion** | Apache Kafka (KRaft, 3 brokers) | Bus de messages distribué, tolérant aux pannes |
| **Traitement** | Apache Spark HA (2 Masters + ZooKeeper) | Streaming temps réel, détection d'anomalies |
| **Stockage** | MongoDB Sharded Cluster (10 conteneurs) | Persistance distribuée avec réplication |

L'ensemble est conteneurisé via **Docker Compose** et démarre en une seule commande.

## Les Composants du Projet

L'architecture est entièrement conteneurisée via Docker et se divise en 3 grandes parties :

1. **Ingestion (Apache Kafka KRaft)** : Un script Python génère des données de capteurs virtuels (température, pression, etc.) et les publie en continu dans un cluster Kafka composé de 3 brokers (pour la tolérance aux pannes).
2. **Traitement Temps Réel (Apache Spark HA)** : Un cluster Spark Structured Streaming consomme les messages Kafka, décode le flux binaire en JSON, valide le schéma des données, et assure la haute disponibilité avec 2 Masters coordonnés par ZooKeeper.
3. **Stockage Distribué & Partitionné (MongoDB Sharded Cluster)** : Les données traitées sont stockées dans une architecture distribuée de pointe composée de 10 conteneurs (Config Servers, Mongos Router, et 2 Shards avec Replica Sets). Les données sont découpées et réparties à 50/50 grâce au *Hashed Sharding*.

---

## Architecture Globale du Pipeline

![Architecture AzurA](assets/architecture_azura.gif)

---

## Architecture Detaillee par Couche

### Couche — Simulation IoT (Ingestion)

Le simulateur Python genere des lectures realistes pour **15 capteurs physiques** repartis sur **5 sites** au Maroc.

#### Les 5 Types de Capteurs

| Type | Unite | Plage Normale | Fabricant |
|------|-------|---------------|-----------|
| `temperature` | degC | 20 - 80 | Siemens Maroc (TH-200X) |
| `vibration` | mm/s | 0 - 5 | Fluke (VB-805) |
| `pression` | bar | 1 - 10 | Bosch (PR-3000) |
| `humidite` | % | 30 - 70 | Honeywell (HM-40) |
| `consommation` | kW | 100 - 500 | Schneider Electric (PM-5000) |

#### Les 15 Capteurs Actifs (repartition par site)

```
Agadir      --> sensor_temp_001, sensor_temp_002, sensor_vib_001
                sensor_pres_001, sensor_hum_001, sensor_pow_001, sensor_pow_002
Dakhla      --> sensor_temp_003, sensor_pres_003, sensor_pow_003
Tanger      --> sensor_vib_002
Casablanca  --> sensor_vib_003
Kenitra     --> sensor_pres_002, sensor_hum_002, sensor_hum_003
```

---

### Couche — MongoDB Sharded Cluster (Stockage Distribue)

![Architecture MongoDB Sharded Cluster](assets/architecture_mongodb_sharded.gif)

MongoDB stocke **uniquement les donnees brutes** (telles qu'elles arrivent de Kafka, sans enrichissement). C'est un **Data Lake** immuable.

---

## Interfaces de Monitoring

Une fois le projet demarre, les interfaces suivantes sont accessibles :

| Interface | URL | Description |
|-----------|-----|-------------|
| Kafka UI | http://localhost:8080 | Visualiser les topics, messages, consommateurs |
| Mongo Express | http://localhost:8082 | Explorer la base `azura_iot` en temps reel |
| Spark Master 1 UI | http://localhost:8081 | Statut du Master Spark actif |
| Spark Master 2 UI | http://localhost:8083 | Statut du Master Spark standby |
| Spark Driver UI | http://localhost:4040 | Suivi du job `stream_processor.py` en cours |

---

## Guide de Demarrage en Local

### Prerequis

- **Docker Desktop** installe et demarre (version 20.10+)
- **Docker Compose** v2+ (inclus dans Docker Desktop)
- **RAM disponible** : minimum 8 Go recommandes (MongoDB + Spark sont intensifs)
- **Ports libres** : `8080`, `8081`, `8082`, `8083`, `4040`, `9092`, `9093`, `9094`, `27017`

### Etape 1 — Cloner le depot

```bash
git clone <url-du-repo>
cd stage_AzurA
```

### Etape 2 — Demarrer l'infrastructure complete

```bash
docker-compose up -d
```

Cette commande demarre **25+ conteneurs** et declenche automatiquement les scripts d'initialisation.

### Etape 3 — Verifier le demarrage (environ 60 a 90 secondes)

Surveiller les logs des services critiques :

```bash
# Verifier que le cluster MongoDB s'est initialise
docker logs mongo-init --follow

# Verifier que les topics Kafka ont ete crees
docker logs kafka-init --follow

# Verifier que le simulateur IoT publie des messages
docker logs iot-simulator --follow

# Verifier que Spark a soumis le job
docker logs spark-submit --follow
```

### Etape 4 — Verification du Pipeline en Temps Reel

**a) Confirmer que des messages arrivent dans Kafka :**

Ouvrir http://localhost:8080 -> onglet "Topics" -> cliquer sur `iot-raw-data` -> "Messages".

**b) Confirmer que les donnees sont stockees dans MongoDB :**

```bash
# Se connecter au routeur Mongos
docker exec -it mongos-router mongosh

# Dans le shell MongoDB
use azura_iot
db.raw_measurements.countDocuments()   # Doit augmenter avec le temps
db.raw_measurements.findOne()          # Voir un document exemple
sh.status()                            # Verifier la repartition du sharding
```

**c) Confirmer les alertes dans le topic Kafka :**

Ouvrir http://localhost:8080 -> topic `iot-alerts` -> observer les messages (apparaissent apres ~60s, lorsque les pannes simulees demarrent).

### Etape 5 — Arreter le projet

```bash
# Arrêter tous les conteneurs (les donnees sont conservees dans les volumes)
docker-compose down

# Arrêter ET supprimer toutes les donnees (volumes inclus)
docker-compose down -v
```

### Depannage Rapide

| Symptome | Cause probable | Solution |
|----------|----------------|----------|
| `mongo-init` en erreur | Mongos pas encore pret | Attendre 30s et relancer `docker-compose up -d mongo-init` |
| Pas de messages dans `iot-raw-data` | `kafka-init` incomplet | `docker logs kafka-init` pour voir les erreurs |
| `spark-submit` redemarre en boucle | Masters Spark pas encore ACTIVE | Attendre 30 a 60s supplementaires |
| Mongo Express inaccessible | `mongo-init` pas encore termine | `docker logs mongo-init` et attendre |

---

## Licence

Ce projet est sous licence **MIT** © 2026 Mohamed Boufous.

