// Short lessons: a few cards to read, then a quiz. Finishing them earns badges and investor points.
export interface Question { q: string; options: string[]; answer: number; why: string }
export interface Lesson { id: string; title: string; minutes: number; icon: string; cards: { title: string; body: string }[]; quiz: Question[] }

export const LESSONS: Lesson[] = [
  {
    id: 'what-is-a-stock', title: 'What is a stock?', minutes: 3, icon: 'pie-chart-outline',
    cards: [
      { title: 'Owning a slice', body: 'A company can be cut into millions of equal pieces called shares. Buy one share and you own a tiny slice of the whole company.' },
      { title: 'Why companies sell shares', body: 'Selling shares raises money to build factories, open shops or invent new products. In return, the buyers become part-owners.' },
      { title: 'How owners can gain', body: 'If the company does well, more people want its shares and the price rises. Some companies also pay owners a dividend out of their profits.' },
      { title: 'How owners can lose', body: 'If the company struggles, the price can fall and your slice is worth less. Share prices are never guaranteed.' },
    ],
    quiz: [
      { q: 'What do you own when you buy a share?', options: ['A loan to the company', 'A small piece of the company', 'One of its products'], answer: 1, why: 'A share is a unit of ownership in the company.' },
      { q: 'Why do companies sell shares?', options: ['To raise money to grow', 'To pay less tax', 'Because the law says so'], answer: 0, why: 'Selling shares brings in money the company can use to grow.' },
      { q: 'Can a share price go down?', options: ['No, never', 'Only on weekends', 'Yes, it can'], answer: 2, why: 'Prices rise and fall. No share price is guaranteed.' },
    ],
  },
  {
    id: 'prices', title: 'Why prices move', minutes: 3, icon: 'trending-up-outline',
    cards: [
      { title: 'Buyers and sellers', body: 'Every trade needs a buyer and a seller. When more people want to buy than sell, the price climbs. When more want to sell, it drops.' },
      { title: 'News matters', body: 'A hit product, a big sale or strong profits can make people want the stock. Bad news can do the opposite.' },
      { title: 'Expectations', body: 'Prices reflect what people expect to happen. A company can report good results and still fall if investors hoped for even better.' },
      { title: 'Nobody knows tomorrow', body: 'Day-to-day moves are close to impossible to predict. That is why many investors think in years.' },
    ],
    quiz: [
      { q: 'More people want to buy a stock than sell it. What usually happens?', options: ['The price rises', 'The price falls', 'Nothing'], answer: 0, why: 'Higher demand than supply pushes the price up.' },
      { q: 'A company reports good profits but the price falls. Why might that be?', options: ['The market made a mistake', 'Investors expected even more', 'Prices only fall on Mondays'], answer: 1, why: 'Prices move on results compared with what was expected.' },
      { q: 'Who can reliably predict tomorrow\'s price?', options: ['Experts on TV', 'Anyone with a chart', 'Nobody'], answer: 2, why: 'Short-term moves are not reliably predictable by anyone.' },
    ],
  },
  {
    id: 'markers', title: 'Reading the markers', minutes: 4, icon: 'speedometer-outline',
    cards: [
      { title: 'Check before you choose', body: 'Every stock here shows markers: quick facts that describe the company and its price. Read them before you buy.' },
      { title: 'Size', body: 'Market cap is what the whole company is worth. Giants tend to be steadier. Smaller companies can grow faster but carry more risk.' },
      { title: 'P/E', body: 'Price-to-earnings is what buyers pay for each $1 of yearly profit. A high number means people expect strong growth. Compare it with similar companies.' },
      { title: 'Dividend and jumpiness', body: 'A dividend is cash paid to owners. Beta shows how much the price swings compared with the market: above 1 is jumpier, below 1 is calmer.' },
      { title: 'No single marker decides', body: 'Markers describe a stock. They do not tell you to buy. Good investors look at several together and ask what the company actually does.' },
    ],
    quiz: [
      { q: 'What does market cap measure?', options: ['The price of one share', 'What the whole company is worth', 'Last year\'s profit'], answer: 1, why: 'Market cap is share price multiplied by the number of shares.' },
      { q: 'A stock has a beta of 1.8. What does that suggest?', options: ['It swings more than the market', 'It pays a big dividend', 'It is a small company'], answer: 0, why: 'A beta above 1 means bigger swings than the market overall.' },
      { q: 'A very high P/E means the stock is definitely a bad buy.', options: ['True', 'False'], answer: 1, why: 'A high P/E shows high expectations. It is not good or bad alone.' },
      { q: 'What is a dividend?', options: ['A fee for trading', 'A type of chart', 'Cash a company pays its owners'], answer: 2, why: 'Dividends are a share of profits paid to shareholders.' },
    ],
  },
  {
    id: 'diversify', title: 'Don\'t put all your eggs in one basket', minutes: 3, icon: 'grid-outline',
    cards: [
      { title: 'One stock is risky', body: 'If all your money is in one company and it has a bad year, your whole portfolio has a bad year.' },
      { title: 'Spread it out', body: 'Owning several companies in different sectors means one bad result hurts less. This is called diversification.' },
      { title: 'Funds do it for you', body: 'An index fund owns hundreds of companies in one purchase. It is the simplest way to spread your money.' },
      { title: 'Cash counts too', body: 'Keeping some cash means you can buy when you find something you like. Cash does not grow, though, so it is a balance.' },
    ],
    quiz: [
      { q: 'What is diversification?', options: ['Buying only tech stocks', 'Spreading money across different investments', 'Selling everything'], answer: 1, why: 'Spreading out means one bad result does less damage.' },
      { q: 'Which is the most diversified?', options: ['An S&P 500 fund', 'One airline', 'Two car makers'], answer: 0, why: 'The fund holds 500 companies across many sectors.' },
      { q: 'Why keep some cash?', options: ['It grows fastest', 'It is required', 'So you can buy later without selling'], answer: 2, why: 'Cash gives you room to act on new ideas.' },
    ],
  },
  {
    id: 'long-term', title: 'Think in years', minutes: 3, icon: 'hourglass-outline',
    cards: [
      { title: 'Patience pays', body: 'Over single days, prices jump around. Over many years, strong companies have tended to grow. Time smooths out the bumps.' },
      { title: 'The snowball', body: 'Gains can earn their own gains. $100 growing 10% a year is about $260 after ten years. This is compounding.' },
      { title: 'Trading a lot rarely helps', body: 'Buying and selling all the time means guessing short-term moves. Most people who do it end up behind those who simply held.' },
      { title: 'Have a reason', body: 'Before you buy, say why in one sentence. If the reason is still true later, a falling price alone is not a reason to sell.' },
    ],
    quiz: [
      { q: 'What is compounding?', options: ['Gains earning their own gains', 'Paying a fee each trade', 'Selling at a loss'], answer: 0, why: 'Growth builds on earlier growth, like a snowball.' },
      { q: 'What usually works better for most investors?', options: ['Trading every day', 'Holding good companies for years', 'Following rumours'], answer: 1, why: 'Frequent trading relies on guessing short-term moves.' },
      { q: 'Your stock drops 5% in a day but nothing about the company changed. A sensible first step is to:', options: ['Sell at once', 'Buy ten more without thinking', 'Check whether your reason for owning it still holds'], answer: 2, why: 'Decide from your reason for owning it, not from one day\'s move.' },
    ],
  },
  {
    id: 'bermuda', title: 'Investing and Bermuda', minutes: 3, icon: 'boat-outline',
    cards: [
      { title: 'A small island with a big role', body: 'Bermuda is one of the world\'s largest centres for reinsurance: insurance for insurance companies.' },
      { title: 'Local companies you can follow', body: 'Some Bermuda companies trade in New York, including Butterfield Bank (NTB) and RenaissanceRe (RNR). Both are in this app.' },
      { title: 'Bermuda has an exchange too', body: 'The Bermuda Stock Exchange (BSX) lists local companies. This app uses US prices because they update all day.' },
      { title: 'Same dollar value', body: 'One Bermuda dollar equals one US dollar, so the prices you see here need no conversion.' },
    ],
    quiz: [
      { q: 'What is reinsurance?', options: ['Insurance for insurance companies', 'A second bank account', 'A type of stock chart'], answer: 0, why: 'Reinsurers share the risk that insurers take on.' },
      { q: 'What is the BSX?', options: ['A US bank', 'The Bermuda Stock Exchange', 'A fund'], answer: 1, why: 'The BSX is Bermuda\'s own stock exchange.' },
      { q: 'How many US dollars is one Bermuda dollar worth?', options: ['Half', 'Two', 'One'], answer: 2, why: 'The Bermuda dollar is pegged one-to-one to the US dollar.' },
    ],
  },
];

export const lesson = (id: string) => LESSONS.find((l) => l.id === id);
