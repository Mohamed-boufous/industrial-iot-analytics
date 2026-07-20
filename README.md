# AzurA IoT Streaming Platform

A robust, real-time IoT data processing and storage platform built with modern Big Data technologies. This project simulates industrial IoT sensors, streams the data in real-time, processes it, and ensures persistent storage with high availability.

![Architecture Diagram](docs/architecture_azura.gif)

## Features

- Real-time IoT sensor simulation (Temperature, Pressure, Humidity, Vibration, Power)
- Highly available message brokering using Apache Kafka (KRaft mode)
- Real-time data processing and schema validation via Apache Spark Structured Streaming
- Fault-tolerant data persistence using a MongoDB Replica Set
- Containerized infrastructure for reproducible deployments

## Technologies Used

- **Apache Kafka**: Event streaming and message queuing
- **Apache Spark**: Stream processing and data transformation
- **MongoDB**: Document storage with Replica Set (rs0) for high availability
- **Docker & Docker Compose**: Container orchestration and networking
- **Python (PySpark)**: Data processing scripts

## Installation

### Prerequisites
- Docker and Docker Compose installed
- Git

### Setup

1. Clone the repository:
```bash
git clone https://github.com/Mohamed-boufous/Azura_project.git
cd Azura_project
```

2. Start the infrastructure:
```bash
docker-compose up -d
```

3. Initialize the MongoDB Replica Set:
```bash
docker exec -it mongo1 mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'mongo1:27017'}, {_id: 1, host: 'mongo2:27017'}, {_id: 2, host: 'mongo3:27017'}]})"
```

4. Restart Spark to establish the connection:
```bash
docker restart spark-submit
```

## Usage

Once the infrastructure is running, the `iot-simulator` service will automatically begin generating and sending sensor data to the `iot-raw-data` Kafka topic.

Spark processes these messages in micro-batches and writes them to the `azura_iot.raw_measurements` collection in MongoDB.

To verify data ingestion:
```bash
docker exec -it mongo2 mongosh
> use azura_iot
> db.raw_measurements.countDocuments()
```

To monitor Kafka topics, access the Kafka UI at `http://localhost:8080`.

## Architecture Details

- **Ingestion**: A Python script generates realistic industrial sensor data and produces it to a 3-broker Kafka cluster.
- **Processing**: A Spark Structured Streaming job consumes binary Kafka messages, parses them using a predefined JSON schema, and structures them into a tabular format.
- **Storage**: Processed records are appended to a MongoDB cluster configured as a 3-node Replica Set to guarantee zero data loss during node failures.

## License

This project is open-source and available under the MIT License.
