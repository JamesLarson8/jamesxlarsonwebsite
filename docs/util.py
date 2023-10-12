# utility functions / Pranay & James

# data description:

#       restuarants is a list of dictionaries

# keys of restuarants are:
    # restuarant = {
    #     "business_id": "string",
    #     "name": "string",
    #     "address": "string",
    #     "city": "string",
    #     "state": "string",
    #     "postal_code": "string",
    #     "latitude": "string",
    #     "longitude": "string",
    #     "stars": "string",
    #     "review_count": "string",
    #     "is_open": "string",
    #     "attributes": dictionary,
    #     "categories": list,
    #     "hours": "string"
# }


from cosinesim import most_similar_reviews


# this function takes in a list of restaurant names and the complete set of restaurants 
# and returns a list of recommended restaurants
# 
# note that the input restaurant names are not necessarily in the list of all restaurants, so check for that
# 
# the input restuarants are a list of dictionaries, the definition inside is commented out above

def generate_recommendations(input_restaurant, city, restaurants):

    r1 = input_restaurant[0]
    r2 = input_restaurant[1]
    r3 = input_restaurant[2]

    my_dict = {d["name"]: d for d in restaurants}
    restaurant1 = my_dict[r1]
    restaurant2 = my_dict[r2]
    restaurant3 = my_dict[r3]
    filtered_list = [c for c in restaurants if c["city"] == city]
    list_of_restaurants = []
    for r in filtered_list:
        score_1 = get_similarity_score(restaurant1, r)
        score_2 = get_similarity_score(restaurant2, r)
        score_3 = get_similarity_score(restaurant3, r)
        avg_score = (score_1+score_2+score_3)/3
        list_of_restaurants.append((r,avg_score))
    sorted_list = sorted(list_of_restaurants, key=lambda x: x[1], reverse=True)
    return sorted_list[0:3]


def get_similarity_score(r1, r2):
    #takes in two restaurants and returns their similarity score
    return get_price_similarity(r1,r2)+get_category_similarity(r1,r2) + float(r2['stars'])

def get_price_similarity(r1,r2):
    #takes in two restaurants and returns how similar their prices are based on the price range in the yelp dataset
    if('attributes' not in r1 or 'attributes' not in r2):
        return 2.5
    # print(r1['attributes'])
    # try:
    #     if ('RestaurantsPriceRange2' in r1['attributes'] and 'RestaurantsPriceRange2' in r2['attributes']):
    #         diff = int(r1['attributes']['RestaurantsPriceRange2']) - int(r2['attributes']['RestaurantsPriceRange2'])
    #         diff = abs(diff)
    #         return 5 - diff
    else:
        return 2.5
def get_category_similarity(r1,r2):
    #takes in two restaurants and returns the jaccard similarity of the set of their categories
    r1_categories = set(r1['categories'])
    r2_categories = set(r2['categories'])
    intersection = r1_categories.intersection(r2_categories)
    union = r2_categories.union(r1_categories)
    sim = len(intersection)/len(union)
    return sim

def cosine_similarity_reviews(r1, r2):
    r1_row = list(business_id_to_text.keys()).index(r1['business_id'])
    r2_row = list(business_id_to_text.keys()).index(r2['business_id'])
    r1_vec = restaurant_topic_matrix[r1_row]
    r2_vec = restaurant_topic_matrix[r2_row]
    return cosine_similarity(r1_vec, r2_vec)

def SVD(tfidf):
    svd = TruncatedSVD(n_components=10)
    svd.fit(tfidf)
    topic_term_matrix = svd.components_
    restaurant_topic_matrix = svd.transform(tfidf)
    return restaurant_topic_matrix
# def generate_recommendations(restaurant_names, restaurants):

#     # PLEASE WRITE YOUR CODE HERE

#     # the dummy version always tells you ["McDonald's", 'Cafe Baladi', 'Chick-fil-A']
#     print(len(restaurants))
#     print(len(restaurant_names))
#     for i in range (2):
#         print(restaurant_names[i])
#         print(restaurants[i]['name'])

#     # find the restaurant business with the name as restaurant_names[0]
#     for restaurant in restaurants:
#         if restaurant["name"] == restaurant_names[0]:
#             print("this is a debug",restaurant)
#             break

#     # most_similar_reviews(restaurant['business_id'], '/Users/erlich_jaso/Desktop/CityFood/4300-Template-Spring-2023/data/reviews.csv')
    
#     return restaurants[0:3]


#JOANNAS GENERATE_RECOMMENDATIONS
# def generate_recommendations(restaurant_names, restaurants):

#     new_restaurants = []
#     for restaurant_name in restaurant_names:
#         for restaurant in restaurants:
#             if restaurant_name.lower() in restaurant["name"].lower():
#                 new_restaurants.append({
#                     "name": restaurant["name"],
#                     "latitude": float(restaurant["latitude"]),
#                     "longitude": float(restaurant["longitude"])
#                 })
#                 break
#     return new_restaurants






# this is previously written code keeping for reference, by pranay.

# def generate_recommendations(name, restaurants):
#     # print(restaurants[0])
#     selected_restaurant = None
#     name_found = False
#     recommended_restaurants = []
#     for r in restaurants:
#         if r['name'] == name:
#             selected_restaurant = r
#             name_found = True
#             break
#     if name_found == False:
#         recommended_restaurants.append('Invalid Input')
#         return recommended_restaurants
#     else:
#         pass
#     for i in restaurants:
#         if selected_restaurant['name'] == i['name']:
#             continue
#         else:
#             if len(recommended_restaurants) > 4:
#                 return recommended_restaurants
#             set1 = set(i['categories'])
#             set2 = set(selected_restaurant['categories'])
#             common_elements = set1.intersection(set2)
#         if len(common_elements) > 0:
#             recommended_restaurants.append(i)
#         else:
#             pass
#     return recommended_restaurants
