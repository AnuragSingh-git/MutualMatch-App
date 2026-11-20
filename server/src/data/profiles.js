const people = [
  ['Maya',24,'Kochi','Collecting tiny moments, big playlists, and cafe recommendations.','film photography, indie music, slow mornings'],
  ['Aarav',26,'Bengaluru','Weekend trekker, weekday product designer. Always up for dosa.','hiking, design, filter coffee'],
  ['Isha',23,'Pune','Will pet every dog and defend pineapple on pizza.','dogs, pottery, comedy'],
  ['Kabir',27,'Mumbai','Learning guitar one slightly-off chord at a time.','live music, books, running'],
  ['Ananya',25,'Delhi','Museum dates and long walks are my kind of plans.','art, history, street food'],
  ['Rohan',24,'Hyderabad','Here for good conversation and better biryani.','cooking, cricket, travel'],
  ['Zoya',26,'Jaipur','I make playlists for people I like. No pressure.','music, architecture, chai'],
  ['Dev',28,'Chennai','Ocean person. Trying to become a morning person.','surfing, cinema, cycling'],
  ['Meera',22,'Kolkata','Poetry, pastries, and finding the sunny seat.','writing, baking, cats'],
  ['Arjun',25,'Ahmedabad','Currently planning a trip around the best thalis.','travel, food, photography'],
  ['Naina',27,'Bengaluru','My plants are thriving. I am taking partial credit.','plants, yoga, sci-fi'],
  ['Vihaan',23,'Goa','Building things by day, looking for sunsets after.','coding, beaches, board games'],
  ['Tara',24,'Mumbai','Big fan of little bookstores and little adventures.','books, hiking, coffee'],
  ['Neil',26,'Pune','I can recommend a movie for every mood.','movies, football, ramen'],
  ['Sana',25,'Lucknow','Family recipes, new cities, familiar songs.','cooking, travel, dance'],
  ['Aditya',29,'Delhi','Trying every sport once; keeping badminton twice.','badminton, podcasts, food'],
  ['Riya',23,'Hyderabad','Designing a life with more color and less rush.','illustration, fashion, cafes'],
  ['Ibrahim',27,'Kochi','Boat rides, good books, questionable puns.','reading, sailing, humor'],
  ['Kiara',24,'Jaipur','I know a shortcut to the best sunset spot.','sunsets, dance, art'],
  ['Manav',26,'Chennai','Making a list of places to eat. It is a long list.','food, running, travel'],
  ['Diya',22,'Kolkata','Student of life, currently majoring in memes.','memes, music, photography'],
  ['Reyansh',28,'Mumbai','A good playlist can fix most commutes.','music, cycling, films'],
  ['Leela',25,'Bengaluru','Dog person, plant person, people person.','dogs, gardening, brunch'],
  ['Siddharth',24,'Pune','Will challenge you at chess and lose gracefully.','chess, tech, trekking'],
  ['Aisha',27,'Delhi','Collecting passport stamps and stories.','travel, food, literature'],
  ['Kunal',23,'Ahmedabad','I make a mean cup of masala chai.','tea, cricket, sketching'],
  ['Pari',26,'Goa','More beach walks, fewer Monday meetings.','beaches, wellness, music'],
  ['Yash',25,'Lucknow','There is no such thing as too many dumplings.','food, gaming, comedy'],
  ['Simran',24,'Chennai','Learning to cook. My roommates are brave.','cooking, yoga, movies'],
  ['Om',27,'Kochi','Searching for the city’s coziest reading nook.','books, cafes, kayaking'],
  ['Avni',23,'Mumbai','Soft spot for handwritten notes and bad puns.','writing, art, plants'],
  ['Dhruv',26,'Jaipur','Mountain air enthusiast. City traffic survivor.','hiking, photography, coffee'],
  ['Pooja',28,'Hyderabad','Happiest when there is music and something to share.','dance, cooking, concerts'],
  ['Ritvik',24,'Kolkata','I take the scenic route, even on Google Maps.','walking, films, history'],
  ['Noor',25,'Bengaluru','Equal parts curious and easily distracted by cats.','cats, design, travel']
];

const colors = ['#c37c6d','#6a887c','#b49158','#88789a','#7585a4','#c1895c'];
export const profiles = people.map(([name,age,city,bio,interestLine], index) => ({
  id: `p${String(index + 1).padStart(3,'0')}`, name, age, city, bio,
  interests: interestLine.split(', '),
  photo: `https://images.unsplash.com/photo-${[
    '1534528741775-53994a69daeb','1500648767791-00dcc994a43e','1524504388940-b1c1722653e1','1506794778202-cad84cf45f1d',
    '1531123897727-8f129e1688ce','1501196354995-cbb51c65aaea','1529139574466-a303027c1d8b','1535713875002-d1d0cf377fde',
    '1526510747491-58f928ec870f','1507003211169-0a1dd7228f2d','1544005313-94ddf0286df2','1517841905240-472988babdf9',
    '1506794778202-cad84cf45f1d','1534528741775-53994a69daeb','1524504388940-b1c1722653e1'
  ][index % 15]}?auto=format&fit=crop&w=1000&q=85`,
  accent: colors[index % colors.length], likedYou: index < 10
}));
