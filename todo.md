# PatientPresence Monitor - Project TODO

## Database & Schema
- [x] Define database schema for patients, face descriptors, detection events, and alerts
- [x] Migrate to MySQL/MariaDB for production use (XAMPP compatible)
- [x] Expand schema to support "People" (Patients, Doctors, Nurses)
- [x] Fix timestamp/datetime compatibility issues for MariaDB
- [x] Generate and apply database migrations using Drizzle-kit

## Backend - People Management
- [x] Create tRPC procedure: people.create (name, role, roomId)
- [x] Create tRPC procedure: people.list (with role filtering)
- [x] Create tRPC procedure: people.getById
- [x] Create tRPC procedure: people.update
- [x] Create tRPC procedure: people.delete
- [x] Create tRPC procedure: people.uploadPhoto (store face descriptor for any person)
- [x] Implement physical activity logging to `logs/activity.log`

## Backend - Detection & Logging
- [x] Create tRPC procedure: logDetectionEvent (patient present/absent/unknown detected/recognized)
- [x] Create tRPC procedure: getDetectionEvents (retrieve event history with filtering)
- [x] Create tRPC procedure: getDetectionEventsByPerson (person-specific events)
- [x] Implement event logging with timestamps and severity levels

## Backend - Alerting System
- [x] Create tRPC procedure: getAlerts (retrieve alert history)
- [x] Implement owner notification on unknown person detection
- [x] Implement owner notification on patient absence
- [x] Create alert log entries for all critical events
- [ ] Implement notification deduplication (avoid spam)

## Frontend - Layout & Navigation
- [x] Set up elegant dashboard layout with sidebar navigation
- [x] Update navigation with proper icons and paths (Patients, Staff, Monitor, Logs, Alerts)
- [x] Implement responsive design for healthcare context
- [x] Choose professional color palette (Indigo/Slate)

## Frontend - People Management UI
- [x] Create patient list page with card view
- [x] Create staff management page for Doctors/Nurses
- [x] Unified "PeoplePhotoUpload" component for face ID enrollment
- [x] Implement photo preview and face detection feedback

## Frontend - Real-Time Monitoring
- [x] Create premium camera feed viewer component
- [x] Implement real-time multi-face recognition
- [x] Identify everyone in frame (e.g., "Nurse Jane", "Dr. Smith")
- [x] Track target patient presence/absence
- [x] Show detected faces with bounding boxes and confidence scores
- [x] Implement visual indicators for detection state and who is in the room

## Frontend - Activity Log Dashboard
- [x] Create detection events table with columns: timestamp, event type, severity, person, details
- [x] Implement filtering by event type and person
- [x] Implement filtering by severity (info, warning, alert)
- [x] Implement date range filtering
- [x] Add export/download functionality for logs

## AI Vision Integration
- [x] Install face-api.js and TensorFlow.js dependencies
- [x] Load face detection models in browser
- [x] Implement face matching algorithm with distance threshold (0.6)
- [x] Support multi-face identification against entire person dataset

## Testing & Refinement
- [x] Write vitest tests for management procedures
- [x] Test face recognition accuracy with various lighting conditions
- [x] Test real-time performance with continuous detection
- [x] Verify MySQL connectivity and schema reliability

## UI Polish & Elegance
- [x] Refine spacing and alignment across all pages
- [x] Add micro-interactions and smooth transitions
- [x] Implement loading states and skeleton screens
- [x] Ensure a premium, trustworthy healthcare aesthetic
- [x] Test responsive design on mobile/tablet

## Documentation & Delivery
- [x] Create database initialization script (`scripts/init-db.ts`)
- [ ] Document face recognition accuracy and limitations
- [x] Update deployment documentation
