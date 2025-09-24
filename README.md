# ep_maadix

This plugin adds the following features to Etherpad:

- User-Management System
- Group-Management System
- Optionally allow register of new users
- Optionally allow public pads
- Opyionally allow users to recover their password
- Administration interface

## Demo

https://demo.maadix.net

## Compatibility

Latest version requires Etherpad >=2.0
Tested up to Etherpad 2.4.2 with Node v22.18.0

## Installation

In order to use this plugin you have to [configure Etherpad to use MySQL as backend database](https://github.com/ether/etherpad-lite/wiki/How-to-use-Etherpad-Lite-with-MySQL).

You can install the plugin from the administrator interface or you can install it with:

    pnpm install ep_maadix


Copy email.json.template to email.json and edit it using your email preferences

Then use the provided [SQL script](/sql_listing.sql) to create the schema:

    mysql -u USER -p < sql_listing.sql

## Usage

Once installed the plugin login as admin into your etherpad installation e.g. https://youretherpadinstallation/admin
Then visit https://youretherpadinstallation/settings

From this area you can create groups, invite users and define settings for the installation.
Users will be able to manage groups, invitations and pads from the front end.

## Credits

It is based in these other plugins that were unmaintained at the time of the development:

- https://github.com/aoberegg/ep_user_pad/
- https://github.com/aoberegg/ep_user_pad_frontend/

