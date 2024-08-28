# Manage your stress - Server

This is the server for the application "Manage your stress". This server handles the registration of new user, login to the app as well as generating and authenticating the JSON Web Tokens. \
This server comes with an SQLLite database which manages the registrated users.

## Installation

Run these commands to clone and install the application:

```
git clone https://github.com/EWimmer1999/Server.git authserver
```

## Setting up the .env
Before running the server you need to update the .env file to be able to use password recovery and to set the secret key for the JWT generation. \
Simple add an .env file that looks like this:

```
# .env

#Port the server is running on
PORT=3000

# Configure your e-mail transporter
EMAIL_PASS=
EMAIL_SERVICE=
EMAIL_HOST=
EMAIL_PORT=

# JWT Secret Key
JWT_SECRET_KEY=
```

## Running the application
The server can be started using:

```
node .\server.js
```

