# Python UART Fingerprint Sensor Library / Python UART Parmak İzi Sensörü Kütüphanesi

[English](#english) | [Türkçe](#türkçe)

---

## English

### Overview
This library provides a Python interface for interacting with UART optical fingerprint sensors (protocol utilizing `0xF5` start/end codes) on Linux devices, specifically tailored for the **Raspberry Pi**.

### Features
- **Enrollment**: Step-by-step fingerprint registration (3 captures).
- **Verification**: 1:N matching to identify registered users.
- **Management**: Get user count, delete specific users, or wipe the database.
- **Protocol**: Handles command packet construction and checksum validation.

### Hardware Requirements
- Raspberry Pi (Zero, 3, 4, 5, etc.)
- UART Fingerprint Sensor Module (e.g., Waveshare UART Fingerprint Sensor (C) or similar generic modules).
- Jumper wires.

### Connection Schema (Wiring)

#### 1. Raspberry Pi
The library uses `/dev/serial0` by default. You must enable the Hardware Serial Port via `sudo raspi-config` > Interface Options > Serial Port (Login shell: NO, Hardware enabled: YES).

| Sensor Pin | Raspberry Pi Pin | Description |
| :--- | :--- | :--- |
| **VIN / VCC** | 5V (Pin 1) | Power supply (Check your sensor specs, usually 3.3V) |
| **GND** | GND (Pin 6) | Ground |
| **RX** | TX (GPIO 14 / Pin 8) | Data Receive (Sensor receives from Pi) |
| **TX** | RX (GPIO 15 / Pin 10)| Data Transmit (Sensor sends to Pi) |
| **WAKE / IRQ**| Not Connected | Not used by this library currently |

> **Note:** Raspberry Pi GPIOs are 3.3V logic. Most of these sensors utilize 3.3V UART logic, which is compatible directly.

#### 2. Arduino (Reference Only)
*This library is for Python/Linux. If connecting the sensor to an Arduino for other projects:*

| Sensor Pin | Arduino Uno/Nano | Description |
| :--- | :--- | :--- |
| **VIN** | 5V | Power |
| **GND** | GND | Ground |
| **RX** | TX (Pin 1 or SoftSerial) | Requires voltage divider (5V -> 3.3V) if sensor is not 5V tolerant |
| **TX** | RX (Pin 0 or SoftSerial) | Connects to Arduino RX |

### Installation & Usage

1. **Install Dependencies:**
   ```bash
   pip install pyserial
   ```

2. **Run the Example:**
   ```bash
   python index.py
   ```

3. **Library Usage Examples:**
   ```python
   from main import FingerprintReader

   # Initialize
   reader = FingerprintReader()

   # --- Get User Count ---
   print("User count:", reader.get_user_count())

   # --- Enroll Fingerprint (ID: 5) ---
   # Follow the terminal prompts
   reader.enroll_fingerprint(user_id=5)

   # --- Verify Fingerprint ---
   user_id = reader.verify_1_to_n()
   if user_id != -1:
       print(f"Verified! User ID: {user_id}")
   else:
       print("Not recognized.")

   # --- Delete User (ID: 5) ---
   reader.delete_user(user_id=5)

   reader.close()
   ```

---


## Türkçe

### Genel Bakış
Bu kütüphane, **Raspberry Pi** gibi Linux cihazlar üzerinde UART optik parmak izi sensörleri (protokolü `0xF5` başlangıç/bitiş kodlarını kullanan) ile etkileşim kurmak için bir Python arayüzü sağlar.

### Özellikler
- **Kayıt (Enroll)**: Adım adım parmak izi kaydı (3 okuma gerektirir).
- **Doğrulama (Verify)**: Kayıtlı kullanıcıları tanımak için 1:N eşleştirme.
- **Yönetim**: Kullanıcı sayısını sorgulama, belirli kullanıcıyı veya tüm veritabanını silme.
- **Protokol**: Komut paketi oluşturma ve checksum (sağlama toplamı) doğrulama işlemlerini yönetir.

### Bağlantı Şeması

#### 1. Raspberry Pi
Kütüphane varsayılan olarak `/dev/serial0` portunu kullanır. `sudo raspi-config` > Interface Options > Serial Port menüsünden donanım seri portunu etkinleştirmelisiniz (Login shell: HAYIR, Hardware enabled: EVET).

| Sensör Pini | Raspberry Pi Pini | Açıklama |
| :--- | :--- | :--- |
| **VIN / VCC** | 5V (Pin 1) | Güç beslemesi (Sensörünüzün voltajını kontrol edin) |
| **GND** | GND (Pin 6) | Toprak (Şase) |
| **RX** | TX (GPIO 14 / Pin 8) | Veri Alma (Sensör Pi'den alır) |
| **TX** | RX (GPIO 15 / Pin 10)| Veri Gönderme (Sensör Pi'ye gönderir) |
| **WAKE / IRQ**| Bağlı Değil | Bu kütüphane tarafından kullanılmamaktadır |

#### 2. Arduino (Sadece Referans)
*Bu kütüphane Python/Linux içindir. Sensörü Arduino ile kullanacaksanız bağlantı şeması şöyledir:*

| Sensör Pini | Arduino Uno/Nano | Açıklama |
| :--- | :--- | :--- |
| **VIN** | 5V | Güç |
| **GND** | GND | Toprak |
| **RX** | TX (Pin 1 veya SoftSerial) | Arduino 5V ise voltaj bölücü gerekebilir |
| **TX** | RX (Pin 0 veya SoftSerial) | Arduino RX pinine bağlanır |

### Kurulum & Kullanım

1. **Bağlılık Kurulumu:**
   ```bash
   pip install pyserial
   ```

2. **Örneği Çalıştır:**
   ```bash
   python index.py
   ```

3. **Kütüphane Kullanım Örnekleri:**
   ```python
   from main import FingerprintReader

   # Başlat
   reader = FingerprintReader()

   # --- Kullanıcı Sayısını Al ---
   print("Kullanıcı sayısı:", reader.get_user_count())

   # --- Parmak İzi Kaydet (ID: 5) ---
   # Terminal yönergelerini takip edin
   reader.enroll_fingerprint(user_id=5)

   # --- Parmak İzi Doğrulama ---
   user_id = reader.verify_1_to_n()
   if user_id != -1:
       print(f"Doğrulandı! Kullanıcı ID: {user_id}")
   else:
       print("Tanınamadı.")

   # --- Kullanıcı Sil (ID: 5) ---
   reader.delete_user(user_id=5)

   reader.close()
   ```

---
