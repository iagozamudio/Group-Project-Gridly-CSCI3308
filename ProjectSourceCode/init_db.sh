#!/bin/bash

# DO NOT PUSH THIS FILE TO GITHUB
# This file contains sensitive information and should be kept private

# TODO: Set your PostgreSQL URI - Use the External Database URL from the Render dashboard
PG_URI="<postgresql://users_db_8aq7_user:CRBeKSeZ698nf92t1vkUfqFFbJBIAwR3@dpg-d7gnln0sfn5c73dv6jh0-a.oregon-postgres.render.com/users_db_8aq7>"

# Execute each .sql file in the directory
for file in init_data/*.sql; do
    echo "Executing $file..."
    psql $PG_URI -f "$file"
done