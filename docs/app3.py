import json
import os
from flask import Flask, render_template, request
from flask_cors import CORS
from helpers.MySQLDatabaseHandler import MySQLDatabaseHandler
from random import randint
import util

import ast


# ROOT_PATH for linking with all your files. 
# Feel free to use a config.py or settings.py with a global export variable
os.environ['ROOT_PATH'] = os.path.abspath(os.path.join("..",os.curdir))

# These are the DB credentials for your OWN MySQL
# Don't worry about the deployment credentials, those are fixed
# You can use a different DB name if you want to
MYSQL_USER = "root"
MYSQL_USER_PASSWORD = ""
MYSQL_PORT = 3306
MYSQL_DATABASE = "CityFood"


mysql_engine = MySQLDatabaseHandler(MYSQL_USER,MYSQL_USER_PASSWORD,MYSQL_PORT,MYSQL_DATABASE)

# Path to init.sql file. This file can be replaced with your own file for testing on localhost, but do NOT move the init.sql file
mysql_engine.load_file_into_db()

app = Flask(__name__)
CORS(app)

# get restaurants from database
load_restaurants = list(mysql_engine.query_selector("SELECT * FROM restaurant"))
keys = ["business_id","name","address","city","state","postal_code","latitude","longitude","stars", "review_count", "is_open", "attributes" , "categories" , "hours" ]
restaurants = [dict(zip(keys,[str(j) for j in i])) for i in load_restaurants]
for r in restaurants:
    x = r['attributes']
    if x=='':
        r['attributes']={}
    else:
        attributes_dict = ast.literal_eval(x)
        r['attributes'] = attributes_dict
    y = r['categories']
    if y == '':
        r['categories'] = []
    else:
        r['categories'] = y.split(", ")

# print(restaurants[0]['categories'][0])


# Sample search, the LIKE operator in this case is hard-coded, 
# but if you decide to use SQLAlchemy ORM framework, 
# there's a much better and cleaner way to do this
def sql_search(episode):
    query_sql = f"""SELECT * FROM episodes WHERE LOWER( title ) LIKE '%%{episode.lower()}%%' limit 10"""
    keys = ["id","title","descr"]
    data = mysql_engine.query_selector(query_sql)
    return json.dumps([dict(zip(keys,i)) for i in data])

@app.route("/")
def home():
    return render_template('base.html',title="sample html")

# @app.route("/episodes")
# def episodes_search():
#     text = request.args.get("title")
#     return sql_search(text)

@app.route('/main')
def main():
    # return render_template('main.html')
    recommended_restaurants = ["McDonald's", 'Cafe Baladi', 'Chick-fil-A']
    return render_template('main.html', recommended_restaurants=recommended_restaurants)

def give_random_restaurant(restaurants):
    random_num = randint(0,len(restaurants)-1)
    return restaurants[random_num]
    # return [dict(zip(keys,[str(j) for j in i])) for i in restaurants][0]

@app.route('/random')
def random():
    random_restaurant = give_random_restaurant(restaurants)
    return json.dumps({"restaurant": random_restaurant })

@app.route('/recommendations')
def recommendations():
    name = util.generate_recommendations("McDonald's", restaurants)[1]
    # print(name)
    return json.dumps({"restaurant": name})


@app.route('/main', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        first = request.form['first']
        second = request.form['second']
        third = request.form['third']
        # zipcode = request.form['zipcode']
        # state = request.form['state']s
        city = request.form['city']
        print(f"You entered {first}, {second}, and {third}.")
        # print(f"Your destination zipcode: {zipcode}")
        # print(f"Your destination state: {state}")
        input_restaurants = [first, second, third]
        # print(restaurants[0])

        # make sure that the first restaurant is in the database            
        if first not in [restaurant['name'] for restaurant in restaurants]:
            return render_template('error.html', input=first)
        # make sure that the second restaurant is in the database
        if second not in [restaurant['name'] for restaurant in restaurants]:
            return render_template('error.html', input=second)
        # make sure that the third restaurant is in the database
        if third not in [restaurant['name'] for restaurant in restaurants]:
            return render_template('error.html', input=third)
        


        output_restaurants = util.generate_recommendations(input_restaurants, city, restaurants)
        print(len(output_restaurants))
        for restaurant in output_restaurants:
            print(restaurant[0])

        output_restaurants = [restaurant[0] for restaurant in output_restaurants]
        print(type(output_restaurants))

        # if the output_restaurants' length is less than 3, then we need to add more restaurants
        if len(output_restaurants) == 0:
            output_restaurants.append(give_random_restaurant(restaurants))
            output_restaurants.append(give_random_restaurant(restaurants))
            output_restaurants.append(give_random_restaurant(restaurants))
        if len(output_restaurants) == 1:
            output_restaurants.append(give_random_restaurant(restaurants))
            output_restaurants.append(give_random_restaurant(restaurants))
        if len(output_restaurants) == 2:
            output_restaurants.append(give_random_restaurant(restaurants))
            

        # print(output_restaurants[0])
        # output_restaurant_info = [{'name': restaurant['name'],'latitude': restaurant['latitude'], 'longitude': restaurant['longitude']} for restaurant in output_restaurants]
        # output_restaurant_info = [{'name': restaurant['name'],'latitude': restaurant['latitude'], 'longitude': restaurant['longitude'], 'address': restaurant['address'], 'city': restaurant['city'], 'state': restaurant['state'],'postalcode': restaurant['postal_code']} for restaurant in output_restaurants]
        return render_template('result.html', input=input_restaurants ,restaurant=output_restaurants)
    else:
        return render_template('main.html')

    



#app.run(debug=True)
# 9738eb1b740d16702a566bfb829517f4b456d49c
