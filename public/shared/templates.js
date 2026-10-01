// Template-based Hinglish generator. Works with ZERO API keys and is the fallback whenever
// AI is disabled, over limits, slow, or returns something the filter rejects.
// All lines are written gender-neutral (respectful plural: "karte hain", "inka") on purpose.
// SHARED FILE: used by the browser (public/, client-side fallback) AND the API server (lib/templates.js re-exports it).
// Edit here only.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RRTemplates = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const WORK = {
    student: {
      label: 'Student',
      told: ['Padhai mein topper hain, bas result thoda late aata hai', 'Future IAS + CEO + Scientist — teeno ek saath', 'Din raat library mein rehte hain', 'Professor log inse notes maangte hain'],
      sach: ['Library sirf free Wi-Fi ke liye jaate hain', 'Exam se ek raat pehle poora syllabus "revise" karte hain', 'Attendance 74.9% — risk lena inki fitrat hai', 'Group project mein sirf PPT ka font choose karte hain'],
      salaryTold: ['Pocket money nahi, "stipend" boliye', 'Future package 50 LPA confirm (astrologer ne bola)', 'Scholarship ke paise se sab manage karte hain'],
      salarySach: ['20 tarikh tak UPI balance: ₹47', 'Canteen mein udhaar ka khaata chal raha hai', 'Papa ke card pe "emergency" har hafte aati hai'],
    },
    it: {
      label: 'IT / Software',
      told: ['Google mein hain', 'Bahut bade software engineer, America wale client hain', 'Laptop pe kuch bahut secret kaam karte hain', 'AI pe kaam karte hain, bas itna samjho'],
      sach: ['Google mein nahi, Google pe sab search karte hain', 'Din bhar "Let me check and revert" type karte hain', 'ChatGPT band ho jaaye toh chhutti le lete hain', 'Standup meeting mein 15 min se "on mute" hain'],
      salaryTold: ['25 LPA (rishtedaaron ke liye)', 'Package itna bada ki bata nahi sakte', 'Dollar mein kamaate hain'],
      salarySach: ['CTC mein free chai aur "learning opportunity" bhi jodi hai', 'In-hand dekh ke HR bhi sorry bolta hai', 'Appraisal mein 3% badha, inflation 6% — math mat poochho'],
    },
    startup: {
      label: 'Startup Founder',
      told: ['Apni company ke CEO hain', 'Agle Zomato/Zerodha ke founder', 'Shark Tank wale bhi inke call ka wait karte hain'],
      sach: ['Company mein CEO, CTO aur chaprasi — teeno khud', 'Pitch deck 47 baar banaya, product abhi "stealth mode" mein hai', 'LinkedIn pe "Building something exciting 🚀" 2 saal se'],
      salaryTold: ['Valuation 100 crore (inke hisaab se)', 'Paisa nahi, equity mein kamaate hain'],
      salarySach: ['Salary: ₹0, Gyaan: unlimited', 'Ghar ka rent abhi bhi papa ke "seed round" se aata hai', 'Funding ka matlab mummy se ₹5000'],
    },
    sarkari: {
      label: 'Sarkari Naukri Aspirant',
      told: ['Bas is baar selection pakka hai', 'UPSC ki taiyari kar rahe hain, bade afsar banenge', 'Prelims nikal gaya tha (2021 mein)'],
      sach: ['Taiyari ka 5th saal, motivation videos ka 50th saal', 'Current affairs mein sirf memes ki knowledge', 'Mukherjee Nagar ki chai ki dukaan inko naam se jaanti hai'],
      salaryTold: ['Sarkari naukri lagte hi 7th Pay Commission', 'Job security hi asli salary hai'],
      salarySach: ['Abhi income source: coaching ki EMI', 'Mahine ka kharcha: Maggi + photocopy'],
    },
    doctor: {
      label: 'Doctor / Medical',
      told: ['Doctor hain, poore mohalle ka free checkup karte hain', 'AIIMS level ke doctor', 'Inki handwriting dekh ke log impress ho jaate hain'],
      sach: ['Har family function mein free consultation counter ban jaate hain', 'Neend aakhri baar 2019 mein li thi', 'Inki handwriting sirf chemist padh paata hai'],
      salaryTold: ['Doctor hai toh paisa toh hoga hi', 'Bahut kamaate hain, bas time nahi hai'],
      salarySach: ['Residency stipend aur 36 ghante ki duty', 'Paisa aayega... 2035 tak'],
    },
    finance: {
      label: 'CA / Finance',
      told: ['CA hain, poore khandaan ka tax bachate hain', 'Bank mein bade officer', 'Share market ke expert'],
      sach: ['31 March ko insaan nahi, Excel sheet ban jaate hain', 'Rishtedaar ITR file karwa ke "thank you" bolke chale jaate hain', 'Balance sheet tally, life abhi bhi mismatch'],
      salaryTold: ['Itna kamaate hain ki khud ka tax khud bachate hain', 'Lakhon mein khelte hain'],
      salarySach: ['Lakhon mein khelte hain — client ke', 'Articleship stipend se Swiggy bhi soch ke order karte hain'],
    },
    creator: {
      label: 'Content Creator',
      told: ['Influencer hain, bahut famous', 'YouTube pe bahut bade star', 'Brands inke peeche bhaagte hain'],
      sach: ['Followers: 847, jinme 300 mummy ki saheliyan', 'Har khaane se pehle 47 photo, khaana thanda', '"Link in bio" bolne ke alawa koi kaam nahi'],
      salaryTold: ['Brand deals se lakhon kamaate hain', 'Collab ka paisa aata hai'],
      salarySach: ['Brand deal = free mein ek face wash', 'Monetization abhi "under review" hai'],
    },
    marketing: {
      label: 'Marketing / Sales',
      told: ['MNC mein manager hain', 'Brand strategy dekhte hain', 'Company inhi ke bharose chal rahi hai'],
      sach: ['"Synergy" aur "leverage" bina matlab ke bolte hain', 'Target ke naam se raat ko neend nahi aati', 'Har baat ka PPT bana dete hain, shaadi ka bhi banayenge'],
      salaryTold: ['Incentive milake bahut ho jaata hai', 'Package mast hai'],
      salarySach: ['Incentive tab milta hai jab target achieve ho (kabhi nahi)', 'Salary credit hote hi EMI le jaati hai'],
    },
    business: {
      label: 'Family Business',
      told: ['Khandaani business sambhalte hain', 'Apna kaam hai, kisi ki naukri nahi karte', 'Business tycoon'],
      sach: ['Dukaan pe baith ke Instagram reels sambhalte hain', 'Papa abhi bhi cash counter ki chaabi nahi dete', 'GST ka naam sunte hi network chala jaata hai'],
      salaryTold: ['Turnover crore mein hai', 'Business mein salary kaisi, sab apna hi hai'],
      salarySach: ['Galla papa ka, kharcha inka', 'Har mahine "market slow hai" bolte hain'],
    },
    freelancer: {
      label: 'Freelancer',
      told: ['Apne boss khud hain', 'Foreign clients ke saath kaam karte hain', 'Work from anywhere — Goa, Manali, sab jagah'],
      sach: ['Client ka "small change" 3 mahine se chal raha hai', 'Payment "next week" 6 hafton se', 'Goa sirf laptop wallpaper mein hai'],
      salaryTold: ['Dollar mein kamaate hain', 'Mahine ka bahut ho jaata hai'],
      salarySach: ['Ek mahina raja, agle teen mahine "pipeline build" karte hain', 'Invoice bhejte hain, reminder bhejte hain, phir dua karte hain'],
    },
    exploring: {
      label: 'Exploring Options',
      told: ['Abhi break pe hain, bade offer ka wait hai', 'Khud ka kuch bada plan kar rahe hain', 'Kai companies ke offers hain, soch rahe hain'],
      sach: ['"Exploring options" 14 mahine se, Netflix poori explore ho gayi', 'Resume mein "self-employed" matlab ghar pe hain', 'Rishtedaaron se bachne ke liye function mein late aate hain'],
      salaryTold: ['Paisa sab kuch nahi hota', 'Investment se income aati hai'],
      salarySach: ['Investment = mummy ke purse se ₹500', 'Income source: Diwali ka shagun'],
    },
    other: {
      label: 'Kuch Aur',
      told: ['Bahut bade kaam mein hain, aap nahi samjhoge', 'Busy itne ki mummy ko appointment leni padti hai', 'Company ki "backbone" hain'],
      sach: ['Kaam kya hai, ye khud bhi confirm nahi kar paaye', 'Ghar walon ko 3 alag-alag job titles bata rakhe hain', 'Busy sirf group chat mein dikhte hain'],
      salaryTold: ['Achha khaasa kama lete hain', 'Salary? Bas bata nahi sakte, nazar lag jaayegi'],
      salarySach: ['Mahine ke end mein Zomato nahi, ghar ka khaana', 'Salary aur month-end ki ladaai mein month-end jeet jaata hai'],
    },
  };

  const VIBE = {
    sanskaari: {
      label: 'Sanskaari',
      hobbies: ['Rishtedaaron ke pair chhoona, bina bole sabka favourite banna', 'Family WhatsApp group pe "Good Morning" bhejna', 'Aarti ke time pe phone silent karna'],
      khoobi: ['Mummy ke saamne aaj tak "No" nahi bola', 'Shaadi mein sabse pehle khaana serve karte hain', 'Elders ke saamne chai bhi sanskaari tareeke se peete hain'],
      redflag: ['Har decision se pehle "ghar pe poochh ke batate hain" mode', 'Raat 10 baje ke baad "so jaana chahiye" lecture', 'Group trip cancel kar dete hain kyunki "ghar pe pooja hai"'],
      match: ['Jo Sunday ko 7 baje uthne ko "normal" maane', 'Jo mummy ke saamne bhi utne hi sanskaari dikhein'],
      tag: ['Aashirwad follows my brother 🙏', 'Sanskaar follows my brother'],
    },
    party: {
      label: 'Party Animal',
      hobbies: ['Har weekend "bas ek drink" (aakhri baar)', 'Dance floor pe "Kala Chashma" pe naagin dance', 'Monday ko "kabhi nahi peeyenge" ki kasam khaana'],
      khoobi: ['Kisi bhi shaadi ko 2 minute mein garba night bana dete hain', 'Poore group ki energy ka powerhouse', 'Baraat mein sabse aage, sabse late tak'],
      redflag: ['Monday ki subah inke liye "national tragedy" hoti hai', 'Har plan "chill hai yaar" se shuru, 3 baje raat khatam', '"Bas 10 min ke liye aa rahe hain" — 5 ghante baad bhi wahin'],
      match: ['Jo 3 baje raat ko bhi "ek jagah aur chalein?" bole', 'Jo dance floor pe inse bada naagin dance kar sake'],
      tag: ['Hangover follows my brother 🥴', 'Party follows my brother'],
    },
    gamer: {
      label: 'Gamer',
      hobbies: ['BGMI mein chicken dinner, real life mein Maggi dinner', '"Bas ek game aur" — raat 4 baje tak', 'Headphone pehen ke duniya ko mute karna'],
      khoobi: ['Reflexes itne fast ki mummy ki chappal bhi dodge kar lete hain', 'Team ko kabhi akela nahi chhodte (game mein)', 'Patience: 1 match ke liye 40 min queue'],
      redflag: ['Lag aaye toh ghar ka router "dushman" ban jaata hai', '"Mummy 5 min" bolke 2 ghante tak online', 'Real life mein bhi respawn ka wait karte hain'],
      match: ['Jo "bas ek game aur" pe naraz na ho', 'Jo duo mein revive kare, real life mein bhi'],
      tag: ['Lag follows my brother 🎮', 'Ping follows my brother'],
    },
    gym: {
      label: 'Gym Freak',
      hobbies: ['Mirror ke saamne 47 selfies, phir 3 sets', 'Har khaane mein protein ginna', 'Leg day skip karna (strategically)'],
      khoobi: ['Shaadi mein saara saamaan akele utha lete hain', 'Discipline itna ki 5 baje alarm se pehle uth jaate hain', 'Ghar ka gas cylinder change karne mein expert'],
      redflag: ['Har baat "bro, protein le" pe khatam', 'Dosti ka test: "Gym chalega kal?"', 'Halwai ki mithai dekh ke macros calculate karte hain'],
      match: ['Jo date pe bhi gym bag le aaye', 'Jo protein shake ko "romantic drink" maane'],
      tag: ['Protein follows my brother 💪', 'Gains follow my brother'],
    },
    binge: {
      label: 'Netflix Addict',
      hobbies: ['Ek weekend mein 3 seasons khatam karna', '"Are you still watching?" pe offend ho jaana', 'Spoilers se bachne ke liye WhatsApp mute karna'],
      khoobi: ['Kisi bhi situation pe ek web-series ka dialogue ready', 'OTT recommendation ke liye poora mohalla inke paas aata hai', 'Patience: subtitles ke saath Korean drama'],
      redflag: ['"Next episode" ka button inka sabse bada weakness', 'Real life ke problems mein bhi "plot twist" dhoondhte hain', 'Raat 3 baje "bas ek episode aur" — 5 ho jaate hain'],
      match: ['Jo apna OTT password share karne ko ready ho', 'Jo spoiler dene ki galti kabhi na kare'],
      tag: ['"Next episode" follows my brother 📺', 'Binge follows my brother'],
    },
    foodie: {
      label: 'Foodie',
      hobbies: ['Shaadi mein sirf menu dekhne jaana', 'Zomato pe 4.5 se kam rating ko ignore karna', 'Gol gappe wale bhaiya se personal rishta'],
      khoobi: ['Shehar ki har chaat ki dukaan ka GPS dimaag mein', 'Kabhi khaana waste nahi hone dete — dusron ka bhi', 'Mood off ho toh momos se therapy'],
      redflag: ['"Thoda sa taste karaunga" — aadhi plate gayab', 'Diet plan Monday se shuru, Monday ko samosa', 'Swiggy wale bhaiya inhe naam se pehchaante hain'],
      match: ['Jo apni plate ki aakhri fry bhi share kare', 'Jo 2 baje raat ko Maggi banane ko ready ho'],
      tag: ['Zomato follows my brother 🍕', 'Biryani follows my brother'],
    },
    ghumakkad: {
      label: 'Ghumakkad',
      hobbies: ['Goa trip plan karna (aaj tak gaye nahi)', 'Pahadon ki reels save karna', 'Har long weekend pe "kahin chalein?" bolna'],
      khoobi: ['Itinerary aisi banate hain ki travel agent bhi sharma jaaye', 'Train ki window seat ke liye kuch bhi kar sakte hain', 'Maggi pahadon pe khaane ka experience rakhte hain'],
      redflag: ['Group trip ka plan 47 baar banta hai, cancel 48 baar', 'Har jagah "sunrise dekhenge" bolke 11 baje uthte hain', 'Bag mein kapde kam, charger zyada'],
      match: ['Jo last-minute Manali plan pe "haan" bole', 'Jo window seat compromise kar le'],
      tag: ['Trip plan follows my brother (trip nahi) 🏔️', 'Wanderlust follows my brother'],
    },
    overthinker: {
      label: 'Overthinker',
      hobbies: ['Raat 2 baje 2014 ki baatein yaad karna', '"Seen" ka matlab 47 tareeke se decode karna', 'Message type karke delete karna'],
      khoobi: ['Har situation ka plan A se Z ready', 'Kabhi kisi ka birthday nahi bhoolte', 'Dusron ki problems ke best counsellor'],
      redflag: ['"Ok" ke reply pe 3 ghante ki research', 'Restaurant mein menu padhte padhte kitchen band ho jaata hai', 'Sapne mein bhi "kya bolna chahiye tha" practise'],
      match: ['Jo "kuch nahi hua" ka matlab sach mein kuch nahi rakhe', 'Jo reply 2 minute mein kare'],
      tag: ['2 AM thoughts follow my brother 🌙', 'Overthinking follows my brother'],
    },
    stocks: {
      label: 'Stocks / Crypto',
      hobbies: ['Subah uth ke pehle Nifty, phir mummy', 'Finfluencer ki reels pe "notes" banana', '"Long term investor" (3 din ke liye)'],
      khoobi: ['Paisa bachane ke 100 tareeke jaante hain', 'Market crash pe bhi shant rehte hain (bahar se)', 'Har shaadi mein SIP ka gyaan muft'],
      redflag: ['Portfolio red ho toh poora ghar silent mode pe', '"Buy the dip" bolte bolte khud dip ho gaye', 'Diwali bonus se pehle "averaging" ka plan'],
      match: ['Jo red candle dekh ke bhi saath de', 'Jo "SIP" ko romantic gift maane'],
      tag: ['Red candle follows my brother 📉', 'Money follows my brother (kabhi kabhi) 📈'],
    },
    cricket: {
      label: 'Cricket Fan',
      hobbies: ['Har match mein ghar baithe "captain" banna', 'Last over mein TV ke saamne lucky position', 'Gully cricket mein "one tip one hand"'],
      khoobi: ['Stats inko apne phone number se zyada yaad', 'Team ke liye full loyalty, haar mein bhi', 'IPL auction mein BCCI se zyada research'],
      redflag: ['Match ke time shaadi ka muhurat ho toh shaadi postpone', 'India haare toh 2 din tak "network issue"', 'Har galti pe "DRS lena chahiye tha"'],
      match: ['Jo final over mein remote na chheene', 'Jo match ke time "baat karni hai" na bole'],
      tag: ['Last over follows my brother 🏏', 'Cricket follows my brother'],
    },
  };

  const HABIT_FLAGS = [
    '"{h}" inke liye aadat nahi, lifestyle hai',
    '{h} mein national level ke khiladi hain',
    'Kehte hain kal se {h} band — 2019 se "kal" chal raha hai',
    '{h}? Inke resume mein "core skill" likha hai',
  ];

  const VERDICTS = [
    'Hamara bachcha laakhon mein ek hai — bas wo laakh abhi mile nahi',
    'Bas {h} chhod de, baaki toh heera hai heera',
    'Dil se bahut pyaara bachcha hai, baaki sab adjust ho jaayega',
    'Sharma ji ke bachche se toh behtar hi hai... shayad',
    'Utna bhi bura case nahi hai jitna dost bolte hain',
    'Rishta pakka samjho, bas thoda kaam-dhanda set ho jaaye',
    'Jaisa bhi hai, apna bachcha hai — return policy nahi hai',
  ];

  const SCORE_LINES = [
    [9.0, 'Rishta Aunty ka VIP client 💍'],
    [8.0, 'Shortlist pakka — chai-samosa pe charcha 🫖'],
    [7.0, 'Promising! Bas mausi se verification baaki 🔍'],
    [0, 'Profile "pending review" mein hai 😅'],
  ];

  const CLOSERS = [
    'Asli baat: banda/bandi dil se gold hai 💛',
    'Real talk: jo bhi milega, lucky hoga ✨',
    'Sach mein: dosti mein inka koi jawab nahi 🤝',
  ];

  // FNV-1a 32-bit hash: tiny, deterministic, identical in Node and browsers (no crypto dependency)
  function hashInt(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  function makeRng(seedStr) {
    let s = hashInt(seedStr) || 1;
    return () => {
      // xorshift32
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  function pickN(rng, arr, n) {
    const copy = [...arr];
    const out = [];
    while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
    return out;
  }

  function scoreLine(score) {
    return SCORE_LINES.find(([min]) => score >= min)[1];
  }

  function generateFromTemplates(input, variant = 0) {
    const w = WORK[input.work] || WORK.other;
    const v = VIBE[input.vibe] || VIBE.sanskaari;
    const rng = makeRng(`${input.name}|${input.city}|${input.work}|${input.vibe}|${input.habit}|${variant}`.toLowerCase());
    const habit = (input.habit || '').trim();
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const fill = (s) => cap(s.replace(/\{h\}/g, habit || 'phone chalana'));

    const redFlags = [];
    if (habit) redFlags.push(fill(pick(rng, HABIT_FLAGS)));
    redFlags.push(...pickN(rng, v.redflag, 2 - redFlags.length));

    let verdict = pick(rng, VERDICTS);
    if (!habit && verdict.includes('{h}')) verdict = VERDICTS[0];

    const score = Math.round((6.4 + rng() * 3.4) * 10) / 10; // 6.4 - 9.8, always positive-ish

    return {
      occupationTold: pick(rng, w.told),
      occupationSach: pick(rng, w.sach),
      salaryTold: pick(rng, w.salaryTold),
      salarySach: pick(rng, w.salarySach),
      hobbies: pick(rng, v.hobbies),
      khoobiyan: pickN(rng, v.khoobi, 2),
      redFlags,
      mummyVerdict: fill(verdict),
      score,
      scoreLine: scoreLine(score),
      idealMatch: pick(rng, v.match),
      tagline: pick(rng, v.tag),
      closer: pick(rng, CLOSERS),
    };
  }

  return { generateFromTemplates, scoreLine, WORK, VIBE };
});
