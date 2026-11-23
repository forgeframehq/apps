// The 30 stocks students choose from: companies they are likely to know, two with a Bermuda connection and one fund.
// Descriptions are written for this app. Keep the list at a size one free data key can refresh (see lib/market.ts).
import type { Sector, Stock } from '@/lib/types';

export const SECTORS: Sector[] = ['Tech', 'Games & Fun', 'Food & Drink', 'Shops & Style', 'Travel & Cars', 'Money', 'Health', 'Bermuda', 'Funds'];

const s = (symbol: string, name: string, sector: Sector, about: string): Stock => ({ symbol, name, sector, about });

export const STOCKS: Stock[] = [
  s('AAPL', 'Apple', 'Tech', 'Makes the iPhone, iPad and Mac, and runs the App Store.'),
  s('MSFT', 'Microsoft', 'Tech', 'Makes Windows, Office and the Xbox, and rents out huge computers over the internet.'),
  s('GOOGL', 'Alphabet (Google)', 'Tech', 'Owns Google Search, YouTube and Android. Most of its money comes from adverts.'),
  s('AMZN', 'Amazon', 'Tech', 'Sells almost everything online and delivers it. Also rents computing power to other companies.'),
  s('NVDA', 'Nvidia', 'Tech', 'Designs the powerful chips used for video games and artificial intelligence.'),
  s('NFLX', 'Netflix', 'Tech', 'Streams films and series to people who pay a monthly fee.'),
  s('SPOT', 'Spotify', 'Games & Fun', 'Streams music and podcasts. People pay monthly or listen with adverts.'),

  s('DIS', 'Disney', 'Games & Fun', 'Makes films and series, runs theme parks and cruise ships, and owns Marvel, Pixar and Star Wars.'),
  s('RBLX', 'Roblox', 'Games & Fun', 'Runs the Roblox platform, where players build and play games. It sells the in-game currency.'),
  s('SONY', 'Sony', 'Games & Fun', 'Makes the PlayStation, cameras and TVs, and owns film and music studios.'),
  s('MAT', 'Mattel', 'Games & Fun', 'Makes toys such as Barbie, Hot Wheels and UNO.'),

  s('MCD', "McDonald's", 'Food & Drink', 'Fast-food restaurants around the world. Most are run by local owners who pay McDonald\'s a share.'),
  s('SBUX', 'Starbucks', 'Food & Drink', 'Coffee shops in more than 80 countries.'),
  s('KO', 'Coca-Cola', 'Food & Drink', 'Makes Coca-Cola, Sprite, Fanta and many other drinks.'),
  s('PEP', 'PepsiCo', 'Food & Drink', 'Makes Pepsi and Gatorade, and snacks such as Lay\'s and Doritos.'),
  s('HSY', 'Hershey', 'Food & Drink', 'Makes chocolate and sweets such as Hershey\'s and Reese\'s.'),

  s('NKE', 'Nike', 'Shops & Style', 'Designs and sells trainers and sports clothing.'),
  s('CROX', 'Crocs', 'Shops & Style', 'Makes Crocs clogs and other casual shoes.'),
  s('WMT', 'Walmart', 'Shops & Style', 'The world\'s biggest chain of supermarkets and general stores.'),
  s('COST', 'Costco', 'Shops & Style', 'Warehouse stores where members pay a yearly fee to buy in bulk at low prices.'),

  s('TSLA', 'Tesla', 'Travel & Cars', 'Makes electric cars and batteries.'),
  s('F', 'Ford', 'Travel & Cars', 'One of the oldest car makers. Known for trucks such as the F-150.'),
  s('DAL', 'Delta Air Lines', 'Travel & Cars', 'An airline that flies passengers around the world, including to Bermuda.'),
  s('RCL', 'Royal Caribbean', 'Travel & Cars', 'Runs cruise ships, some of which visit Bermuda.'),

  s('V', 'Visa', 'Money', 'Runs the network that moves money when people pay by Visa card.'),
  s('JPM', 'JPMorgan Chase', 'Money', 'The largest bank in the United States.'),

  s('JNJ', 'Johnson & Johnson', 'Health', 'Makes medicines and medical equipment.'),

  s('NTB', 'Butterfield Bank', 'Bermuda', 'A bank founded in Bermuda in 1858, with branches across the island.'),
  s('RNR', 'RenaissanceRe', 'Bermuda', 'A Bermuda reinsurer. It insures insurance companies against disasters such as hurricanes.'),

  s('SPY', 'S&P 500 fund (SPY)', 'Funds', 'One share owns a tiny piece of 500 of the largest US companies at once.'),
];
