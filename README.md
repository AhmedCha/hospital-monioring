# Hospital Monitoring System

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=000000)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=ffffff)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=ffffff)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1-06B6D4?logo=tailwindcss&logoColor=ffffff)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=ffffff)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=ffffff)](https://expressjs.com/)
[![tRPC](https://img.shields.io/badge/tRPC-11.6-398CCB?logo=trpc&logoColor=ffffff)](https://trpc.io/)
[![Firebase](https://img.shields.io/badge/Firebase-12.13-FFCA28?logo=firebase&logoColor=000000)](https://firebase.google.com/)
[![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-4.22-FF6F00?logo=tensorflow&logoColor=ffffff)](https://www.tensorflow.org/js)
[![Vercel](https://img.shields.io/badge/Vercel-Serverless-000000?logo=vercel&logoColor=ffffff)](https://vercel.com/)
[![ESP32](https://img.shields.io/badge/ESP32-IoT-323330?logo=espressif&logoColor=ffffff)](https://www.espressif.com/)

A real-time hospital monitoring platform that combines IoT vitals streaming, on-device face recognition, and server-side analytics to support clinical awareness and alerting.

---

## 📋 Table of Contents

- [Overview](#overview)
- [🗺️ System Architecture](#️-system-architecture)
- [🤖 AI Models & How They Work](#-ai-models--how-they-work)
  - [1. TinyFaceDetector](#1-tinyfacedetector)
  - [2. FaceLandmark68Net](#2-facelandmark68net)
  - [3. FaceRecognitionNet](#3-facerecognitionnet)
  - [4. FaceExpressionNet](#4-faceexpressionnet)
  - [5. Statistical Vitals AI Engine](#5-statistical-vitals-ai-engine)
- [🏗️ Tech Stack](#️-tech-stack)
- [⚙️ Environment Variables](#️-environment-variables)
- [🚀 Running Locally](#-running-locally)

---

## Overview

The Hospital Monitoring System enables real-time patient monitoring through:

- **Face recognition** to verify patient/staff presence in rooms
- **IoT vitals streaming** (heart rate, SpO2, temperature, humidity) via ESP32 sensors
- **AI-driven clinical insights** to detect anomalies and forecast vital trends
- **Role-based access** for Admins, Doctors, Nurses, and Patients

---

## 🗺️ System Architecture

### Full System Data Flow

```mermaid
flowchart TD
    subgraph HW["🔌 Hardware Layer"]
        ESP32["ESP32 Microcontroller\n(Heart Rate + DHT Sensor)"]
    end

    subgraph FIREBASE["☁️ Firebase (Google Cloud)"]
        RTDB["Realtime Database\n(live vitals stream)"]
        FS["Firestore\n(users · people · events · alerts)"]
        AUTH["Firebase Auth\n(identity provider)"]
    end

    subgraph CDN["🌐 jsDelivr CDN"]
        WEIGHTS["face-api.js Model Weights\n(~6 MB .bin files)"]
    end

    subgraph BROWSER["💻 Browser — React Client (Vite)"]
        UI["Dashboard UI\n(React + Radix UI + Recharts)"]
        WEBCAM["Webcam Stream\n(getUserMedia)"] 

        subgraph FACEAI["🤖 AI Layer 1 — face-api.js on TensorFlow.js WebGL"]
            TFD["① TinyFaceDetector\nDetect face bounding boxes"]
            LM["② FaceLandmark68Net\nMap 68 facial keypoints"]
            REC["③ FaceRecognitionNet\nGenerate 128D descriptor vector"]
            EXP["④ FaceExpressionNet\nClassify 7 expressions"]
        end

        MATCH["Euclidean Distance Matching\ncompare vs enrolled descriptors"]
        ENROLLEDDB[("Enrolled Descriptors\n(loaded from Firestore)")]
    end

    subgraph SERVER["⚙️ Server — Node.js / Express (Vercel Serverless)"]
        TRPC["tRPC Router"]
        AUTH_R["auth router\n(Firebase token → JWT session)"]
        PEOPLE_R["people router\n(patients · staff · enrollment)"]
        EVENTS_R["events router\n(log detection events)"]
        ALERTS_R["alerts router\n(fetch alert logs)"]

        subgraph VITALAI["🤖 AI Layer 2 — Statistical Vitals Engine"]
            ZSCORE["Z-Score Anomaly Detection\n(σ > 2.5 = anomaly)"]
            LR["Linear Regression Forecasting\n(next 5-min prediction)"]
            RULES["Rule-based Interpreter\n(stable / warning / critical)"] 
        end

        AI_R["ai router\n(getInsights endpoint)"]
        EMAIL["Nodemailer\n(email alerts)"]
    end

    %% Hardware → Firebase
    ESP32 -->|"MQTT / HTTP POST vitals"| RTDB

    %% CDN → Browser (model loading)
    WEIGHTS -->|"load model weights once"| TFD
    WEIGHTS -->|"load model weights once"| LM
    WEIGHTS -->|"load model weights once"| REC
    WEIGHTS -->|"load model weights once"| EXP

    %% Browser face pipeline
    WEBCAM -->|"video frames"| TFD
    TFD -->|"bounding boxes"| LM
    LM -->|"68 landmarks"| REC
    REC -->|"128D descriptor"| MATCH
    LM -->|"normalized face"| EXP
    ENROLLEDDB -->|"known descriptors"| MATCH

    %% Firebase → Browser
    FS -->|"enrolled face descriptors"| ENROLLEDDB
    RTDB -->|"real-time vitals (WebSocket)"| UI

    %% Browser → Server
    MATCH -->|"trpc.events.log (recognized / unknown)"| EVENTS_R
    UI -->|"trpc.ai.getInsights (vitals history)"| AI_R
    UI -->|"trpc.auth.login (Firebase ID token)"| AUTH_R
    UI -->|"trpc.people.* (CRUD)"| PEOPLE_R
    UI -->|"trpc.alerts.list"| ALERTS_R

    %% Server AI pipeline
    AI_R --> ZSCORE
    ZSCORE --> LR
    LR --> RULES
    RULES -->|"status + insight + forecast"| UI

    %% Server → Firebase
    AUTH_R -->|"verifyIdToken"| AUTH
    EVENTS_R -->|"write event"| FS
    EVENTS_R -->|"push event"| RTDB
    ALERTS_R -->|"read alerts"| FS
    PEOPLE_R -->|"read/write people"| FS
    EVENTS_R -->|"critical alert → email"| EMAIL

    %% Styles
    style FACEAI fill:#1e3a5f,stroke:#3b82f6,color:#fff
    style VITALAI fill:#1e3a1e,stroke:#22c55e,color:#fff
    style FIREBASE fill:#7c2d12,stroke:#f97316,color:#fff
    style CDN fill:#4a1d96,stroke:#a855f7,color:#fff
    style HW fill:#1e1e1e,stroke:#6b7280,color:#fff
    style BROWSER fill:#1a1a2e,stroke:#60a5fa,color:#fff
    style SERVER fill:#1a2e1a,stroke:#4ade80,color:#fff
```

---

### 🤖 AI Call Sequence — Face Recognition

```mermaid
sequenceDiagram
    autonumber
    participant CAM as 📷 Webcam
    participant CDN as 🌐 jsDelivr CDN
    participant TFD as TinyFaceDetector
    participant LM as FaceLandmark68Net
    participant REC as FaceRecognitionNet
    participant EXP as FaceExpressionNet
    participant MATCH as Euclidean Matcher
    participant FS as 🔥 Firestore
    participant SRV as ⚙️ Server (tRPC)

    Note over CAM,SRV: Model Loading (once on page load)
    CDN-->>TFD: Load weights (~800 KB)
    CDN-->>LM: Load weights (~350 KB)
    CDN-->>REC: Load weights (~6 MB)
    CDN-->>EXP: Load weights (~300 KB)

    Note over CAM,SRV: Enrollment (admin, one-time per person)
    CAM->>REC: Photo of patient/staff
    LM->>REC: 68 landmarks (normalization)
    REC-->>FS: Save 128D descriptor array

    Note over CAM,SRV: Live Monitoring Loop (every ~500ms)
    CAM->>TFD: Video frame
    TFD-->>LM: Face bounding boxes
    LM-->>REC: 68 facial landmarks
    LM-->>EXP: Normalized face crop
    REC-->>MATCH: 128D descriptor
    FS-->>MATCH: All enrolled descriptors
    MATCH-->>MATCH: Euclidean distance for each pair
    alt distance < 0.6 (match found)
        MATCH->>SRV: trpc.events.log — "person recognized"
    else distance ≥ 0.6 (no match)
        MATCH->>SRV: trpc.events.log — "unknown person detected"
    end
    SRV->>FS: Write DetectionEvent + AlertLog
```

---

### 🤖 AI Call Sequence — Vitals Analysis

```mermaid
sequenceDiagram
    autonumber
    participant ESP as 🔌 ESP32 Sensor
    participant RTDB as 🔥 Realtime DB
    participant UI as 💻 Dashboard UI
    participant SRV as ⚙️ Server (tRPC)
    participant ZSCORE as Z-Score Engine
    participant LR as Linear Regression
    participant RULES as Rule Interpreter

    ESP->>RTDB: POST heart rate + SpO2 + temp + humidity
    RTDB-->>UI: Real-time push (WebSocket)
    UI->>UI: Accumulate vitals history (sliding window)

    UI->>SRV: trpc.ai.getInsights(patientId, vitalsHistory[])
    activate SRV

    SRV->>ZSCORE: heartRate[], spO2[]
    ZSCORE-->>SRV: anomalyFlags[] (true/false per reading)

    SRV->>LR: heartRate[], spO2[]
    LR-->>SRV: next 5 predicted values for each

    SRV->>RULES: latest reading + anomaly flags
    RULES-->>SRV: status (stable/warning/critical) + insight text

    SRV-->>UI: { status, insight, anomalies, forecast }
    deactivate SRV

    UI->>UI: Render status badge + insight card + forecast chart
```

---

---

## 🤖 AI Models & How They Work

This project uses **two distinct AI systems**: an on-device face recognition pipeline powered by deep learning neural networks, and a server-side statistical inference engine for patient vitals analysis. **No external AI API calls are made** — all inference happens either in the user's browser or on the application server.

---

### 1. TinyFaceDetector

| Property | Details |
|---|---|
| **Library** | `face-api.js` v0.22.2 ([@vladmandic](https://github.com/vladmandic/face-api) fork) |
| **Runtime** | TensorFlow.js v4.22.0 with WebGL backend |
| **Where it runs** | ✅ **Client-side — in the browser (WebGL GPU)** |
| **Model weights hosted at** | `https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/` (jsDelivr CDN) |

**What it does:**
TinyFaceDetector is a lightweight, fast Convolutional Neural Network (CNN) that scans each video frame from the room camera to detect bounding boxes around all visible faces. It is optimized for real-time use — running every few hundred milliseconds on a live webcam stream — while being small enough to load over the network and execute entirely in the browser.

**How it works in this project:**

```
Live webcam video frame
        ↓
TinyFaceDetector (CNN)
        ↓
Bounding boxes for each detected face
        ↓
Passed to FaceLandmark68Net + FaceRecognitionNet
```

---

### 2. FaceLandmark68Net

| Property | Details |
|---|---|
| **Library** | `face-api.js` v0.22.2 |
| **Runtime** | TensorFlow.js v4.22.0 with WebGL backend |
| **Where it runs** | ✅ **Client-side — in the browser (WebGL GPU)** |
| **Model weights hosted at** | `https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/` (jsDelivr CDN) |

**What it does:**
FaceLandmark68Net is a neural network that maps 68 precise facial keypoints (eyes, nose, mouth, jawline, eyebrows) onto each detected face bounding box. These landmarks are used to normalize the face geometry before it is passed to the recognition network, significantly improving accuracy regardless of pose or lighting changes.

**How it works in this project:**

```
Face bounding box (from TinyFaceDetector)
        ↓
FaceLandmark68Net
        ↓
68 facial landmark coordinates
        ↓
Face geometry normalization
        ↓
Input for FaceRecognitionNet
```

---

### 3. FaceRecognitionNet

| Property | Details |
|---|---|
| **Library** | `face-api.js` v0.22.2 |
| **Architecture** | ResNet-34 inspired deep CNN |
| **Output** | 128-dimensional face embedding (descriptor vector) |
| **Runtime** | TensorFlow.js v4.22.0 with WebGL backend |
| **Where it runs** | ✅ **Client-side — in the browser (WebGL GPU)** |
| **Model weights hosted at** | `https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/` (jsDelivr CDN) |

**What it does:**
FaceRecognitionNet is the core identity model. It takes a normalized face crop and outputs a 128-number vector (a "face descriptor") that uniquely encodes the person's facial features. Two photos of the same person will produce very similar vectors; photos of different people will produce very different vectors. Identity matching is done by computing the **Euclidean distance** between two descriptors — a distance below `0.6` is treated as a match (≥60% confidence).

**How it works in this project:**

*Enrollment (one-time setup per person):*

```
Admin uploads a clear photo of patient/staff
        ↓
FaceRecognitionNet generates a 128D descriptor
        ↓
Descriptor saved to Firebase Firestore (as a number array)
```

*Live recognition (continuous during monitoring):*

```
New face detected in the video stream
        ↓
FaceRecognitionNet generates a 128D descriptor
        ↓
Euclidean distance compared against all enrolled descriptors
        ↓
If distance < 0.6 → Patient/Staff recognized ✅
If distance ≥ 0.6 → Unknown person ⚠️
        ↓
Event logged to Firebase + alert triggered if unauthorized
```

---

### 4. FaceExpressionNet

| Property | Details |
|---|---|
| **Library** | `face-api.js` v0.22.2 |
| **Output** | Probability scores for 7 expressions (happy, sad, angry, fearful, disgusted, surprised, neutral) |
| **Runtime** | TensorFlow.js v4.22.0 with WebGL backend |
| **Where it runs** | ✅ **Client-side — in the browser (WebGL GPU)** |
| **Model weights hosted at** | `https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/` (jsDelivr CDN) |

**What it does:**
FaceExpressionNet classifies the emotional expression on each detected face into one of 7 categories. It is loaded alongside the other models but is available for use in future features such as patient distress detection or well-being monitoring.

---

### 5. Statistical Vitals AI Engine

| Property | Details |
|---|---|
| **Type** | Custom rule-based + statistical algorithm (no external AI API) |
| **Where it runs** | ✅ **Server-side — Node.js / Express on Vercel** |
| **Endpoint** | `trpc.ai.getInsights` |
| **External API** | ❌ None — fully self-contained |

**What it does:**
This is the project's server-side intelligence layer. It analyzes a patient's historical vitals (heart rate, SpO2) and produces clinical insights, anomaly flags, and short-term forecasts. It consists of three algorithms working in sequence:

#### Algorithm 1 — Z-Score Anomaly Detection

```
Collect last N readings of Heart Rate / SpO2
        ↓
Calculate mean (μ) and standard deviation (σ)
        ↓
For each reading: Z-Score = |value − μ| / σ
        ↓
If Z-Score > 2.5 → reading is flagged as an anomaly
```

Detects sudden spikes or drops that deviate significantly from the patient's own recent baseline — more personalized than fixed clinical thresholds.

#### Algorithm 2 — Linear Regression Forecasting

```
Take the sequence of recent vitals readings
        ↓
Fit a least-squares linear regression line: y = slope·x + intercept
        ↓
Extrapolate 5 future data points (≈ next 5 minutes)
        ↓
Return predicted Heart Rate and SpO2 trend
```

Provides short-term trend forecasting to help clinicians anticipate deterioration before it becomes critical.

#### Algorithm 3 — Rule-based Clinical Interpretation

```
Latest SpO2 < 94% OR anomaly detected → Status: WARNING
Heart Rate > 110 BPM or < 50 BPM OR anomaly → Status: WARNING
Heart Rate > 130 BPM → Status: CRITICAL
SpO2 < 90% → Status: CRITICAL (immediate assessment required)
All within range → Status: STABLE
```

Translates the raw numbers and anomaly flags into a human-readable clinical status and actionable insight message displayed on the dashboard.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS v4, Radix UI, Recharts |
| **Backend** | Node.js, Express, tRPC v11 |
| **Database** | Firebase Firestore (persistent data) + Firebase Realtime Database (live events) |
| **Authentication** | Firebase Authentication + JWT session cookies |
| **AI — Face Recognition** | face-api.js + TensorFlow.js (WebGL, runs in browser) |
| **AI — Vitals Analysis** | Custom statistical engine (runs on server) |
| **IoT Hardware** | ESP32 microcontroller (heart rate sensor, DHT sensor) |
| **Deployment** | Vercel (serverless) |
| **Email Alerts** | Nodemailer |

---

## ⚙️ Environment Variables

Create a `.env` file at the project root with the following:

```env
# Firebase Client (public)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_DATABASE_URL=

# Firebase Admin (server-side, keep secret)
FIREBASE_SERVICE_ACCOUNT=   # base64-encoded service account JSON

# App Config
OWNER_OPENID=               # Firebase UID of the admin user
COOKIE_SECRET=              # Random secret for JWT session signing

# Email Alerts
EMAIL_USER=
EMAIL_PASS=
NOTIFICATION_EMAIL=
```

> ⚠️ **Never commit `.env` to Git.** The `FIREBASE_SERVICE_ACCOUNT` and `COOKIE_SECRET` are sensitive credentials.

---

## 🚀 Running Locally

```bash
# Install dependencies
pnpm install

# Start development server (frontend + backend)
pnpm dev
```

The app runs at `http://localhost:5000` by default.

```bash
# Run tests
pnpm test

# Type-check
pnpm check

# Production build
pnpm build
```
