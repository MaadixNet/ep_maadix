CREATE DATABASE IF NOT EXISTS etherpad;

USE etherpad;

CREATE TABLE IF NOT EXISTS `GroupPads` (
	`GroupID` int(11) NOT NULL,
	`PadName` varchar(255) COLLATE utf8_bin NOT NULL,
	PRIMARY KEY (`GroupID`,`PadName`)
	);

CREATE TABLE IF NOT EXISTS `Groups` (
	`groupID` int(11) NOT NULL AUTO_INCREMENT,
	`name` varchar(255) COLLATE utf8_bin NOT NULL DEFAULT '',
	PRIMARY KEY (`groupID`,`name`)
	);

CREATE TABLE IF NOT EXISTS `User` (
	`userID` int(11) NOT NULL AUTO_INCREMENT,
	`name` varchar(255) COLLATE utf8_bin NOT NULL DEFAULT '',
        `email` varchar(255) NOT NULL,
	`password` varchar(255) COLLATE utf8_bin DEFAULT NULL,
	`confirmed` tinyint(11) DEFAULT NULL,
	`FullName` varchar(255) COLLATE utf8_bin DEFAULT NULL,
	`confirmationString` varchar(255) COLLATE utf8_bin DEFAULT NULL,
	`salt` varchar(255) COLLATE utf8_bin DEFAULT NULL,
	`active` int(1) DEFAULT NULL,
	PRIMARY KEY (`userID`,`name`)
	);

CREATE TABLE IF NOT EXISTS `UserGroup` (
	`userID` int(11) NOT NULL DEFAULT '0',
	`groupID` int(11) NOT NULL DEFAULT '0',
	`Role` int(11) DEFAULT NULL,
	PRIMARY KEY (`userID`,`groupID`)
	);

CREATE TABLE IF NOT EXISTS `Settings` (
	`key` varchar(255) COLLATE utf8_bin NOT NULL,
	`value` int(11) NOT NULL,
	PRIMARY KEY (`key`)
	);

INSERT INTO `Settings` VALUES
	('register_enabled', 1),
	('public_pads', 1),
	('recover_pw', 1);
