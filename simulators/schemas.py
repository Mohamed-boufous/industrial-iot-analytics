from pydantic import BaseModel, Field
from typing import Literal

class SensorMetadata(BaseModel):
    manufacturer: str
    model: str
    firmware_version: str
    calibration_date: str

class SensorReading(BaseModel):
    device_id: str
    device_type: Literal["temperature", "vibration", "pression", "humidite", "consommation"]
    location: str
    timestamp: str
    value: float
    unit: str
    # NOTE: le champ 'status' a été retiré intentionnellement.
    # La détection d'anomalie (normal/critical) est la responsabilité de Spark (couche traitement).
    metadata: SensorMetadata
    quality_score: float = Field(..., ge=0.0, le=1.0)
    battery_level: float = Field(..., ge=0.0, le=100.0)
    signal_strength: int

# Modèles spécifiques hérités si nécessaire ou pour la documentation / typage fort
class TemperatureReading(SensorReading):
    device_type: Literal["temperature"] = "temperature"
    unit: Literal["°C"] = "°C"

class VibrationReading(SensorReading):
    device_type: Literal["vibration"] = "vibration"
    unit: Literal["mm/s"] = "mm/s"

class PressionReading(SensorReading):
    device_type: Literal["pression"] = "pression"
    unit: Literal["bar"] = "bar"

class HumiditeReading(SensorReading):
    device_type: Literal["humidite"] = "humidite"
    unit: Literal["%"] = "%"

class ConsommationReading(SensorReading):
    device_type: Literal["consommation"] = "consommation"
    unit: Literal["kW"] = "kW"
