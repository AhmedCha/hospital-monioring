CREATE TABLE `alert_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`detectionEventId` int,
	`alertType` enum('unknown person detected','patient missing') NOT NULL,
	`severity` enum('warning','alert') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text,
	`roomId` varchar(255),
	`isResolved` int NOT NULL DEFAULT 0,
	`notificationSent` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `alert_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `detection_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int,
	`userId` int NOT NULL,
	`eventType` enum('patient present','patient absent','unknown person detected') NOT NULL,
	`severity` enum('info','warning','alert') NOT NULL,
	`description` text,
	`detectedFaceDescriptor` json,
	`matchConfidence` decimal(5,4),
	`roomId` varchar(255),
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `detection_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `patients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`roomId` varchar(255) NOT NULL,
	`photoUrl` varchar(512),
	`photoStorageKey` varchar(512),
	`enrolledFaceDescriptor` json,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `patients_id` PRIMARY KEY(`id`)
);
