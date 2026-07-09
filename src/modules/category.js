// category.js — Site Category Classifier module

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

function extractUrlTokens(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const parts = host.split('.');
    const subParts = parts.slice(0, -2);
    const subStr = subParts.join(' ').replace(/-/g, ' ').replace(/\d+/g, ' ').trim();
    const rootName = parts.length >= 2 ? parts[parts.length - 2] : '';
    const path = u.pathname.toLowerCase().replace(/[/_-]/g, ' ');
    const allText = `${subStr} ${rootName} ${host} ${path}`;
    return { host, subStr, rootName, path, allText };
  } catch {
    return { host: url, subStr: '', rootName: '', path: '', allText: url };
  }
}

export const CATEGORIES = [
  // ── 1. Government ─────────────────────────────────────────
  {
    id: 'government', label: 'Government', emoji: '🏛️', cssClass: 'cat-government',
    description: 'An official government or public-sector website.',
    tlds: ['.gov','.gov.uk','.gov.in','.gov.au','.gc.ca','.gob.mx','.gouv.fr',
           '.gov.za','.gov.sg','.govt.nz','.gov.ng','.gov.pk','.gov.br','.gov.ph',
           '.gov.eg','.gov.tr','.gov.my','.gov.ae','.gov.kw','.gov.sa'],
    domains: ['whitehouse.gov','irs.gov','usa.gov','europa.eu','un.org',
              'nato.int','data.gov','congress.gov','senate.gov','who.int',
              'worldbank.org','imf.org','icao.int','oecd.org','wto.org'],
    subdomainKw: ['gov','govt','government','federal','state','municipal','city','county','ministry'],
    keywords: [
      {w:'federal government',s:24},{w:'official government',s:24},{w:'government portal',s:26},
      {w:'ministry of',s:20},{w:'parliament',s:18},{w:'senate',s:16},{w:'congress',s:16},
      {w:'legislation',s:16},{w:'public service',s:18},{w:'civil service',s:16},
      {w:'state agency',s:20},{w:'national authority',s:22},{w:'municipal',s:12},
      {w:'government',s:12},{w:'official',s:8},{w:'prefecture',s:16},{w:'governor',s:14},
      {w:'public sector',s:18},{w:'department of',s:14},{w:'bureau of',s:14}
    ],
    negativeKw: ['shop','buy','cart','game','movie','social media','tweet','recipe','stream'],
    minScore: 0, requireDomain: false
  },

  // ── 2. Military / Defense ──────────────────────────────────
  {
    id: 'military', label: 'Military / Defense', emoji: '🎖️', cssClass: 'cat-military',
    description: 'A military, defense, or armed-forces organization.',
    tlds: ['.mil'],
    domains: ['nato.int','army.mil','navy.mil','af.mil','marines.mil','defense.gov','dod.gov',
              'mod.uk','army.mod.uk','raf.mod.uk'],
    subdomainKw: ['mil','army','navy','airforce','defense','military'],
    keywords: [
      {w:'armed forces',s:26},{w:'defense department',s:24},{w:'military base',s:24},
      {w:'military',s:20},{w:'pentagon',s:20},{w:'veteran',s:16},{w:'troops',s:16},
      {w:'soldier',s:14},{w:'marine corps',s:20},{w:'naval',s:16},{w:'brigade',s:14},
      {w:'air force',s:18},{w:'defense contractor',s:22},{w:'national guard',s:20}
    ],
    negativeKw: ['shop','game','social','news','recipe','movie','stream'],
    minScore: 20, requireDomain: false
  },

  // ── 3. Education ──────────────────────────────────────────
  {
    id: 'education', label: 'Education', emoji: '🎓', cssClass: 'cat-education',
    description: 'A school, university, or educational platform.',
    tlds: ['.edu','.ac.uk','.ac.in','.edu.au','.sch.uk','.edu.pk','.edu.sg','.edu.ph','.edu.ng'],
    domains: ['coursera.org','udemy.com','khanacademy.org','edx.org','duolingo.com',
              'chegg.com','quizlet.com','skillshare.com','pluralsight.com',
              'mit.edu','harvard.edu','stanford.edu','oxford.ac.uk','cambridge.org',
              'codecademy.com','brilliant.org','futurelearn.com','teachable.com',
              'duolingo.com','kahoot.com','quizizz.com','academia.edu','researchgate.net',
              'ed.gov','schoology.com','instructure.com','blackboard.com','canvas.net',
              'masterclass.com','datacamp.com','udacity.com','w3schools.com','freecodecamp.org'],
    subdomainKw: ['edu','academy','college','university','school','ac','learn','class','course','curriculum'],
    keywords: [
      {w:'university',s:20},{w:'college',s:20},{w:'curriculum',s:20},{w:'course outline',s:22},
      {w:'academics',s:18},{w:'tuition fees',s:20},{w:'enrolment',s:16},{w:'scholarship',s:18},
      {w:'higher education',s:22},{w:'student portal',s:24},{w:'online learning',s:20},
      {w:'syllabus',s:20},{w:'admissions',s:16},{w:'faculty',s:14},{w:'campus',s:14},
      {w:'e-learning',s:18},{w:'textbook',s:16},{w:'lesson plan',s:20},{w:'school',s:8},
      {w:'education',s:10},{w:'alumni',s:12},{w:'degree program',s:22}
    ],
    negativeKw: ['shop','buy','cart','game','casino','bet','movie','stream'],
    minScore: 0, requireDomain: false
  },

  // ── 4. Healthcare ─────────────────────────────────────────
  {
    id: 'healthcare', label: 'Healthcare', emoji: '🏥', cssClass: 'cat-healthcare',
    description: 'A hospital, clinic, or medical portal.',
    tlds: ['.gov.uk'],
    domains: ['nih.gov','cdc.gov','who.int','nhs.uk','webmd.com','mayoclinic.org',
              'healthline.com','medlineplus.gov','pubmed.ncbi.nlm.nih.gov','fda.gov',
              'clevelandclinic.org','hopkinsmedicine.org','drugs.com','rxlist.com',
              'epocrates.com','medscape.com','doximity.com','zocdoc.com','epic.com',
              'caqh.org','proview.caqh.org','availity.com','optum.com','cerner.com',
              'athenahealth.com','practicefusion.com','carecloud.com'],
    subdomainKw: ['health','medical','clinic','hospital','patient','provider','physician','md','rx','pharmacy','dental','care'],
    keywords: [
      {w:'credentialing',s:26},{w:'provider portal',s:24},{w:'patient care',s:24},
      {w:'clinical trials',s:22},{w:'medical records',s:22},{w:'patient portal',s:22},
      {w:'electronic health record',s:24},{w:'practitioner',s:16},{w:'healthcare',s:16},
      {w:'health insurance',s:16},{w:'hospitals',s:14},{w:'diagnosis',s:14},
      {w:'symptoms',s:12},{w:'treatment plan',s:20},{w:'prescriptions',s:18},
      {w:'oncology',s:18},{w:'cardiology',s:18},{w:'pediatrics',s:18},{w:'medical',s:8},
      {w:'physician',s:10},{w:'doctor',s:10},{w:'pharmaceutical',s:16}
    ],
    negativeKw: ['game','casino','bet','movie','recipe','stream','shop','checkout'],
    minScore: 0, requireDomain: false
  },

  // ── 5. Finance / Banking ───────────────────────────────────
  {
    id: 'finance', label: 'Finance / Banking', emoji: '💰', cssClass: 'cat-finance',
    description: 'A bank, financial institution, or investment portal.',
    domains: ['chase.com','bankofamerica.com','wellsfargo.com','citi.com','hsbc.com',
              'paypal.com','stripe.com','schwab.com','fidelity.com','vanguard.com',
              'robinhood.com','coinbase.com','binance.com','nasdaq.com','nyse.com',
              'mint.com','creditkarma.com','capitalone.com','amex.com','americanexpress.com',
              'transferwise.com','wise.com','revolut.com','sofi.com','ally.com'],
    subdomainKw: ['bank','banking','finance','investment','trading','wealth','portfolio','credit','loan','card','pay','checkout'],
    keywords: [
      {w:'online banking',s:26},{w:'savings account',s:24},{w:'checking account',s:24},
      {w:'credit card',s:22},{w:'mortgage rates',s:20},{w:'mutual funds',s:22},
      {w:'stock trading',s:22},{w:'interest rates',s:18},{w:'financial advisor',s:20},
      {w:'annual report',s:16},{w:'assets',s:14},{w:'liabilities',s:14},
      {w:'wealth management',s:24},{w:'cryptocurrency',s:16},{w:'investment',s:12},
      {w:'finance',s:10},{w:'brokerage',s:18},{w:'transaction history',s:22}
    ],
    negativeKw: ['game','recipe','movie','stream','social','chat'],
    minScore: 16, requireDomain: false
  },

  // ── 6. E-commerce / Retail ─────────────────────────────────
  {
    id: 'ecommerce', label: 'E-commerce', emoji: '🛒', cssClass: 'cat-ecommerce',
    description: 'An online store, shopping platform, or retail brand.',
    domains: ['amazon.com','ebay.com','walmart.com','target.com','shopify.com',
              'etsy.com','bestbuy.com','homedepot.com','wayfair.com','costco.com',
              'aliexpress.com','alibaba.com','temu.com','shein.com','nike.com',
              'adidas.com','sephora.com','nordstrom.com','zara.com','hmo.com'],
    subdomainKw: ['shop','store','buy','cart','checkout','order','market','retail','ecommerce'],
    keywords: [
      {w:'add to cart',s:30},{w:'add to bag',s:30},{w:'buy now',s:26},{w:'checkout',s:26},
      {w:'shopping cart',s:28},{w:'free shipping',s:22},{w:'return policy',s:20},
      {w:'coupon code',s:18},{w:'product description',s:16},{w:'retailer',s:16},
      {w:'price match',s:18},{w:'gift card',s:14},{w:'store locator',s:12},
      {w:'shop online',s:20},{w:'customer reviews',s:12},{w:'wishlist',s:16},
      {w:'order tracking',s:22},{w:'best sellers',s:12}
    ],
    negativeKw: ['government','military','credentialing','hospital','recipe','stream','movie','social media'],
    minScore: 16, requireDomain: false
  },

  // ── 7. Social Media ────────────────────────────────────────
  {
    id: 'social', label: 'Social Media', emoji: '💬', cssClass: 'cat-social',
    description: 'A social network, chat community, or blogging service.',
    domains: ['facebook.com','twitter.com','x.com','instagram.com','linkedin.com',
              'tiktok.com','pinterest.com','reddit.com','tumblr.com','flickr.com',
              'snapchat.com','whatsapp.com','telegram.org','discord.com','mastodon.social',
              'medium.com','substack.com','blogger.com','wordpress.com','weibo.com'],
    subdomainKw: ['social','community','forum','chat','profile','network','tweet','post','group'],
    keywords: [
      {w:'follow us',s:20},{w:'share on facebook',s:24},{w:'tweet this',s:24},
      {w:'add connection',s:18},{w:'profile picture',s:18},{w:'news feed',s:16},
      {w:'social network',s:22},{w:'online community',s:20},{w:'discussion forum',s:20},
      {w:'group chat',s:18},{w:'direct message',s:18},{w:'hashtag',s:14},
      {w:'timeline',s:12},{w:'comment section',s:14},{w:'subscribers',s:12},
      {w:'followers',s:12},{w:'repost',s:14},{w:'blog post',s:14}
    ],
    negativeKw: ['government','military','credentialing','hospital','checkout','buy now'],
    minScore: 24, requireDomain: true
  },

  // ── 8. Technology ──────────────────────────────────────────
  {
    id: 'technology', label: 'Technology', emoji: '💻', cssClass: 'cat-technology',
    description: 'A software company, IT service, or tech documentation page.',
    domains: ['github.com','gitlab.com','bitbucket.org','stackoverflow.com',
              'npmjs.com','pypi.org','docker.com','kubernetes.io','aws.amazon.com',
              'cloud.google.com','azure.microsoft.com','hashicorp.com','vercel.app',
              'netlify.app','heroku.com','digitalocean.com','linode.com',
              'npm.run','mdn.mozilla.org','w3.org','ietf.org','github.io'],
    subdomainKw: ['tech','software','developer','api','dev','git','cloud','docs','code','status','it','admin','ops','portal'],
    keywords: [
      {w:'api documentation',s:26},{w:'software engineer',s:20},{w:'command line',s:20},
      {w:'open source',s:20},{w:'source code',s:20},{w:'sdk',s:16},{w:'deployment',s:18},
      {w:'cloud computing',s:20},{w:'ci/cd',s:22},{w:'database',s:14},{w:'repository',s:14},
      {w:'web application',s:16},{w:'compiler',s:16},{w:'framework',s:14},
      {w:'it infrastructure',s:24},{w:'sysadmin',s:18},{w:'saas',s:14},{w:'scalability',s:14}
    ],
    negativeKw: ['hospital','government','recipe','used cars','auto financing'],
    minScore: 16, requireDomain: false
  },

  // ── 9. News / Media ────────────────────────────────────────
  {
    id: 'news', label: 'News / Media', emoji: '📰', cssClass: 'cat-news',
    description: 'A newspaper, broadcast channel, or current events portal.',
    domains: ['nytimes.com','cnn.com','bbc.com','bbc.co.uk','reuters.com',
              'bloomberg.com','wsj.com','apnews.com','foxnews.com','nbcnews.com',
              'huffpost.com','theguardian.com','washingtonpost.com','usatoday.com',
              'time.com','forbes.com','ft.com','aljazeera.com','lemonde.fr','spiegel.de'],
    subdomainKw: ['news','daily','tribune','journal','times','herald','press','post','reporter','breaking'],
    keywords: [
      {w:'breaking news',s:28},{w:'editorial',s:22},{w:'headline',s:20},{w:'news report',s:20},
      {w:'journalism',s:20},{w:'world news',s:22},{w:'political analyst',s:18},
      {w:'correspondent',s:16},{w:'press release',s:16},{w:'opinion piece',s:18},
      {w:'investigative',s:14},{w:'latest updates',s:12},{w:'newsletter',s:10},
      {w:'obituary',s:12},{w:'weather forecast',s:12},{w:'classifieds',s:12},
      {w:'sports section',s:12},{w:'columnist',s:16}
    ],
    negativeKw: ['government','military','credentialing','hospital','checkout','used cars'],
    minScore: 24, requireDomain: false
  },

  // ── 10. Gaming ─────────────────────────────────────────────
  {
    id: 'gaming', label: 'Gaming', emoji: '🎮', cssClass: 'cat-gaming',
    description: 'A video game site, gaming community, or database.',
    domains: ['ign.com','gamespot.com','twitch.tv','steamcommunity.com','steampowered.com',
              'epicgames.com','roblox.com','minecraft.net','playstation.com','xbox.com',
              'nintendo.com','discord.gg','fandom.com','nexusmods.com','giantbomb.com',
              'polygon.com','kotaku.com','rockpapershotgun.com','metacritic.com','itch.io'],
    subdomainKw: ['game','games','gaming','play','arcade','mod','mods','clan','guild','esports','stream','retro'],
    keywords: [
      {w:'multiplayer',s:26},{w:'gameplay',s:24},{w:'walkthrough',s:20},{w:'modifications',s:18},
      {w:'leaderboard',s:20},{w:'achievements',s:16},{w:'e-sports',s:22},{w:'console',s:14},
      {w:'controller',s:14},{w:'gaming community',s:22},{w:'patch notes',s:18},
      {w:'beta testing',s:16},{w:'graphics card',s:14},{w:'dlc',s:16},{w:'avatar',s:12},
      {w:'co-op',s:16},{w:'mmorpg',s:22},{w:'steam key',s:20}
    ],
    negativeKw: ['hospital','government','credentialing','insurance plan'],
    minScore: 16, requireDomain: false
  },

  // ── 11. Entertainment ──────────────────────────────────────
  {
    id: 'entertainment', label: 'Entertainment', emoji: '🎬', cssClass: 'cat-entertainment',
    description: 'A movie, streaming service, music site, or pop-culture portal.',
    domains: ['netflix.com','youtube.com','vimeo.com','imdb.com','spotify.com',
              'hulu.com','disneyplus.com','hbomax.com','paramountplus.com','apple.com/apple-tv-plus',
              'soundcloud.com','pandora.com','bandcamp.com','genius.com','billboard.com',
              'rollingstone.com','variety.com','hollywoodreporter.com','tmz.com','eonline.com'],
    subdomainKw: ['movie','movies','music','video','cinema','tv','show','shows','stream','watch','radio','tickets'],
    keywords: [
      {w:'now streaming',s:26},{w:'tv series',s:24},{w:'cast and crew',s:20},{w:'season finale',s:18},
      {w:'soundtrack',s:20},{w:'film festival',s:20},{w:'box office',s:18},{w:'concert tour',s:20},
      {w:'celebrity gossip',s:22},{w:'music video',s:18},{w:'discography',s:18},
      {w:'album release',s:16},{w:'review score',s:12},{w:'trailer',s:14},
      {w:'pop culture',s:16},{w:'theatre',s:12},{w:'episodes',s:12},{w:'showtime',s:14}
    ],
    negativeKw: ['government','military','credentialing','hospital','checkout'],
    minScore: 24, requireDomain: false
  },

  // ── 12. Reference / Wiki ───────────────────────────────────
  {
    id: 'reference', label: 'Reference / Wiki', emoji: '📚', cssClass: 'cat-reference',
    description: 'An encyclopedia, dictionary, or documentation library.',
    domains: ['wikipedia.org','wiktionary.org','britannica.com','dictionary.com',
              'thesaurus.com','merriam-webster.com','scholar.google.com','arxiv.org',
              'wikihow.com','imdb.com','fandom.com','encyclopedia.com','archives.gov',
              'loc.gov','gutenberg.org','archive.org','manualslib.com','citizendium.org'],
    subdomainKw: ['wiki','dictionary','ref','reference','encyclopedia','archive','manual','docs','faq','guide'],
    keywords: [
      {w:'encyclopedia',s:26},{w:'etymology',s:22},{w:'bibliography',s:20},{w:'historical archives',s:22},
      {w:'citation needed',s:20},{w:'reference manual',s:22},{w:'definitions',s:18},
      {w:'pronunciation',s:16},{w:'synonyms',s:18},{w:'user guide',s:16},
      {w:'academic paper',s:18},{w:'public archive',s:18},{w:'compendium',s:16},
      {w:'glossary',s:14},{w:'citations',s:14},{w:'fact sheet',s:16},
      {w:'documentation',s:12},{w:'index',s:10}
    ],
    negativeKw: ['shop','buy','cart','game','casino','bet','movie','stream'],
    minScore: 16, requireDomain: false
  },

  // ── 13. Design / Creative ──────────────────────────────────
  {
    id: 'design', label: 'Design / Creative', emoji: '🎨', cssClass: 'cat-design',
    description: 'A design agency, portfolio, or creative resource.',
    domains: ['behance.net','dribbble.com','artstation.com','deviantart.com',
              'pinterest.com','adobe.com','figma.com','canva.com','unsplash.com',
              'pexels.com','pixabay.com','shutterstock.com','gettyimages.com',
              'fontspace.com','dafont.com','fonts.google.com','creativemarket.com'],
    subdomainKw: ['design','portfolio','creative','art','gallery','graphics','brand','studio','creative','photo'],
    keywords: [
      {w:'creative portfolio',s:26},{w:'brand identity',s:22},{w:'graphic design',s:22},
      {w:'typography',s:20},{w:'user experience',s:20},{w:'stock photos',s:20},
      {w:'vector illustrations',s:22},{w:'art direction',s:18},{w:'case study',s:16},
      {w:'creative agency',s:20},{w:'web design',s:16},{w:'fonts',s:14},
      {w:'icon pack',s:14},{w:'ui/ux',s:16},{w:'gallery',s:12},{w:'mockup',s:16},
      {w:'moodboard',s:14},{w:'illustrations',s:12}
    ],
    negativeKw: ['government','military','credentialing','hospital','checkout'],
    minScore: 16, requireDomain: false
  },

  // ── 14. Travel / Tourism ───────────────────────────────────
  {
    id: 'travel', label: 'Travel / Tourism', emoji: '✈️', cssClass: 'cat-travel',
    description: 'A travel booking site, hotel, or tourism guide.',
    domains: ['booking.com','expedia.com','airbnb.com','tripadvisor.com','skyscanner.net',
              'kayak.com','agoda.com','hotels.com','lonelyplanet.com','trip.com',
              'yelp.com','uber.com','lyft.com','hertz.com','avis.com','enterprise.com'],
    subdomainKw: ['travel','tourism','hotel','hotels','flight','flights','booking','vacation','resort','trip','tour','rental'],
    keywords: [
      {w:'hotel booking',s:26},{w:'vacation rental',s:26},{w:'flight status',s:22},
      {w:'travel itinerary',s:22},{w:'tourist guide',s:20},{w:'car rental',s:20},
      {w:'travel agency',s:22},{w:'destination guide',s:18},{w:'resort',s:16},
      {w:'sightseeing',s:16},{w:'travel tips',s:14},{w:'luggage policy',s:14},
      {w:'room availability',s:18},{w:'reviews',s:10},{w:'trip advisor',s:16},
      {w:'travel guide',s:14},{w:'bookings',s:12},{w:'reservations',s:12}
    ],
    negativeKw: ['government','military','credentialing','hospital','used cars'],
    minScore: 20, requireDomain: false
  },

  // ── 15. Food / Recipe ──────────────────────────────────────
  {
    id: 'food', label: 'Food / Recipe', emoji: '🍳', cssClass: 'cat-food',
    description: 'A cooking blog, recipe database, or food brand.',
    domains: ['allrecipes.com','epicurious.com','foodnetwork.com','bonappetit.com',
              'delish.com','seriouseats.com','simplyrecipes.com','tasty.co',
              'yummly.com','cookpad.com','grubhub.com','doordash.com','ubereats.com',
              'yelp.com','tripadvisor.com','opentable.com',' Zagat.com'],
    subdomainKw: ['recipe','recipes','cook','cooking','food','kitchen','restaurant','dine','dining','chef','menu','bakery'],
    keywords: [
      {w:'easy recipe',s:26},{w:'prep time',s:24},{w:'cooking instructions',s:24},
      {w:'ingredients list',s:22},{w:'nutrition facts',s:18},{w:'baking temperature',s:20},
      {w:'meal prep',s:20},{w:'culinary arts',s:18},{w:'restaurant menu',s:22},
      {w:'food delivery',s:20},{w:'table reservation',s:22},{w:'chef profile',s:16},
      {w:'gourmet cooking',s:18},{w:'cookbook',s:16},{w:'dessert',s:14},{w:'cooking tips',s:14},
      {w:'delicious',s:10},{w:'homemade',s:12}
    ],
    negativeKw: ['government','military','credentialing','hospital','used cars'],
    minScore: 20, requireDomain: false
  },

  // ── 16. Enterprise / Corporate ─────────────────────────────
  {
    id: 'enterprise', label: 'Enterprise / Corporate', emoji: '🏢', cssClass: 'cat-enterprise',
    description: 'An enterprise B2B company, consulting firm, or business portal.',
    domains: ['ibm.com','accenture.com','mckinsey.com','deloitte.com','pwc.com',
              'ey.com','kpmg.com','salesforce.com','sap.com','oracle.com',
              'microsoft.com','apple.com','alphabet.xyz','meta.com','amazon.jobs',
              'workday.com','adp.com','zoom.us','slack.com','trello.com'],
    subdomainKw: ['corporate','enterprise','consulting','firm','company','business','b2b','careers','investors','press','management'],
    keywords: [
      {w:'enterprise software',s:26},{w:'business solutions',s:22},{w:'consulting services',s:22},
      {w:'corporate office',s:20},{w:'investor relations',s:20},{w:'executive leadership',s:18},
      {w:'b2b company',s:22},{w:'industry analyst',s:16},{w:'careers portal',s:18},
      {w:'press release',s:14},{w:'case studies',s:14},{w:'client testimonials',s:14},
      {w:'professional services',s:20},{w:'corporate governance',s:18},{w:'sustainability report',s:16},
      {w:'annual general meeting',s:18},{w:'company values',s:12},{w:'global operations',s:14}
    ],
    negativeKw: ['game','recipe','movie','stream','social','chat'],
    minScore: 16, requireDomain: false
  },

  // ── 17. Portal / Directory ──────────────────────────────────
  {
    id: 'portal', label: 'Portal / Directory', emoji: '🗂️', cssClass: 'cat-portal',
    description: 'A web portal, search engine, or category directory.',
    domains: ['google.com','yahoo.com','bing.com','duckduckgo.com','yandex.com',
              'baidu.com','msn.com','aol.com','craigslist.org','yellowpages.com',
              'yelp.com','angileads.com','dmoztools.net','startpage.com','qwant.com'],
    subdomainKw: ['portal','directory','search','index','links','find','list','yellowpages','pages','leads'],
    keywords: [
      {w:'search engine',s:26},{w:'web portal',s:24},{w:'category directory',s:24},
      {w:'local listings',s:20},{w:'business directory',s:22},{w:'search results',s:20},
      {w:'classified ads',s:18},{w:'yellow pages',s:22},{w:'web index',s:18},
      {w:'curated links',s:16},{w:'portal login',s:14},{w:'site list',s:12},
      {w:'directories',s:12},{w:'listings',s:12},{w:'bookmarks',s:14},{w:'search query',s:14}
    ],
    negativeKw: ['government','military','credentialing','hospital','checkout'],
    minScore: 20, requireDomain: false
  },

  // ── 18. Automotive ──────────────────────────────────────────
  {
    id: 'automotive', label: 'Automotive', emoji: '🚗', cssClass: 'cat-automotive',
    description: 'A car manufacturer, dealership, or vehicle review site.',
    domains: ['tesla.com','toyota.com','ford.com','honda.com','bmw.com',
              'mercedes-benz.com','audi.com','volkswagen.com','hyundai.com','chevrolet.com',
              'autotrader.com','carmax.com','edmunds.com','kbb.com','caranddriver.com',
              'motortrend.com','cars.com','copart.com','iaai.com','truecar.com'],
    subdomainKw: ['auto','cars','car','dealer','dealership','motors','vehicles','automotive','drive','racing'],
    keywords: [
      {w:'car dealership',s:32},{w:'vehicle listing',s:30},{w:'used cars',s:30},
      {w:'new car price',s:30},{w:'test drive',s:26},{w:'auto financing',s:28},
      {w:'fuel economy',s:24},{w:'horsepower',s:24},{w:'torque',s:20},
      {w:'electric vehicle',s:26},{w:'car review',s:26},{w:'vehicle history',s:24},
      {w:'car insurance',s:22},{w:'vin number',s:24},
      {w:'car',s:8},{w:'vehicle',s:10},{w:'automotive',s:14},{w:'dealership',s:16}
    ],
    negativeKw: ['hospital','government','game','recipe','credentialing','insurance plan'],
    minScore: 16, requireDomain: false
  }
];

export function classifySite(url, title, description) {
  const domain  = getDomain(url).toLowerCase();
  const fullUrl = url.toLowerCase();
  const tokens  = extractUrlTokens(url);

  // Full corpus for keyword matching (title + desc + all url tokens)
  const corpus = `${title} ${description} ${tokens.allText}`.toLowerCase();

  const results = [];

  for (const cat of CATEGORIES) {
    let score = 0;
    let hasDomainSignal = false;

    // ── 1. TLD match (+80, strongest)
    for (const tld of (cat.tlds || [])) {
      const tldNoSlash = tld.replace(/\//g, '');
      if (domain.endsWith(tldNoSlash) || fullUrl.includes(tld + '/')) {
        score += 80;
        hasDomainSignal = true;
        break;
      }
    }

    // ── 2. Known domain exact match (+60)
    for (const d of (cat.domains || [])) {
      if (domain === d || domain.endsWith('.' + d)) {
        score += 60;
        hasDomainSignal = true;
        break;
      }
    }

    // ── 3. Subdomain / path keyword match (+25 each, max 2 hits)
    let subHits = 0;
    for (const kw of (cat.subdomainKw || [])) {
      if (subHits >= 2) break;
      if (tokens.allText.includes(kw)) {
        score += 25;
        hasDomainSignal = true;
        subHits++;
      }
    }

    // ── 4. Keyword scoring on full corpus
    for (const { w, s } of (cat.keywords || [])) {
      if (corpus.includes(w)) {
        score += s;
      }
    }

    // ── 5. Negative keyword penalty (–12 each)
    for (const nk of (cat.negativeKw || [])) {
      if (corpus.includes(nk)) {
        score -= 12;
      }
    }

    // ── 6. requireDomain gate
    if (cat.requireDomain && !hasDomainSignal) continue;

    // ── 7. minScore threshold
    if (score < (cat.minScore || 0)) continue;

    if (score > 0) {
      results.push({ cat, score, hasDomainSignal });
    }
  }

  // ── No matches at all
  if (!results.length) {
    return {
      category: {
        id: 'unknown', label: 'General Website', emoji: '🌐',
        cssClass: 'cat-unknown',
        description: 'Not enough signals to determine a specific category.'
      },
      confidence: 'low', score: 0
    };
  }

  // ── Sort by score
  results.sort((a, b) => b.score - a.score);
  const top  = results[0];
  const next = results[1];
  const gap  = next ? (top.score - next.score) : top.score;

  // ── Confidence level
  let confidence;
  if      (top.score >= 80 || gap >= 50) confidence = 'high';
  else if (top.score >= 40 || gap >= 20) confidence = 'medium';
  else                                    confidence = 'low';

  // ── If barely any evidence, fall back gracefully
  if (top.score < 15) {
    return {
      category: {
        id: 'unknown', label: 'General Website', emoji: '🌐',
        cssClass: 'cat-unknown',
        description: 'Not enough signals to reliably classify this site.'
      },
      confidence: 'low', score: top.score
    };
  }

  return { category: top.cat, confidence, score: top.score };
}
