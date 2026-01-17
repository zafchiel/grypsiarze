CREATE TABLE `daily_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` date NOT NULL,
	`timeouts` int NOT NULL DEFAULT 0,
	`bans` int NOT NULL DEFAULT 0,
	CONSTRAINT `daily_stats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` text NOT NULL,
	`message` text NOT NULL,
	`timestamp` timestamp DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `zbrodniarze` (
	`id` int AUTO_INCREMENT NOT NULL,
	`timestamp` timestamp DEFAULT (now()),
	`type` text NOT NULL,
	`channel` text NOT NULL,
	`username` text NOT NULL,
	`duration` int NOT NULL,
	CONSTRAINT `zbrodniarze_id` PRIMARY KEY(`id`)
);
