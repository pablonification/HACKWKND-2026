import imgKancil from '../../assets/landing/kancil-buaya.png';
import imgSantubong from '../../assets/landing/santubong.png';
import imgSunbeFenyi from '../../assets/landing/sunbe-fenyi.png';
import imgFifineImbo from '../../assets/landing/fifine-imbo.png';
import bgKancil from '../../assets/story/1.jpg';
import bgSantubong from '../../assets/story/2.jpg';
import scene1Kancil from '../../assets/story/1.jpg';
import scene1Santubong from '../../assets/story/2.jpg';

export interface StoryScene {
  image: string;
  /** Semai text shown on this page */
  text: string;
  /** Optional Malay subtitle shown below the Semai text */
  subtitle?: string;
  /** Word to highlight (first occurrence will be underlined) */
  highlightWord?: string;
}

export interface Story {
  id: string;
  title: string;
  author: string;
  cover: string;
  bg: string;
  duration: string;
  pages: number;
  genre: string;
  synopsis: string;
  lastChapter: string;
  lastPage: number;
  totalPages: number;
  /** Progress percentage 0–100 */
  progress: number;
  /** Reading page scenes (swipeable slides) */
  scenes?: StoryScene[];
}

export const STORIES: Story[] = [
  {
    id: 'kancil',
    title: 'Kancil & Buaya',
    author: 'Cerite Rakyat',
    cover: imgKancil,
    bg: bgKancil,
    duration: '15 min',
    pages: 8,
    genre: 'Fable',
    synopsis:
      'Cerite becog lok bahyak — kisah seekor kancil yang cerdik memperdaya kawanan buaya di sungai untuk menyeberang ke tebing seberang. Sebuah kisah dongeng pendek tentang kepintaran dan akal yang mengalahkan kekuatan.',
    lastChapter: 'Satu Cerite',
    lastPage: 1,
    totalPages: 8,
    progress: 0,
    scenes: [
      {
        image: scene1Kancil,
        text: 'Cerite cermor leng\nbecog lok bahyak',
        subtitle: 'Kisah Dongeng Pendek\nKancil dan Buaya',
        highlightWord: 'becog',
      },
      {
        image: scene1Kancil,
        text: 'Ba ajak arik entem,\nku bab darat,\nsentak becog de cerdeg lok cennong.',
        subtitle:
          'Pada suatu masa dahulu,\ndi sebuah hutan,\nhiduplah seekor kancil yang cerdik dan licik.',
        highlightWord: 'becog',
      },
      {
        image: scene1Kancil,
        text: 'Ilei hod dos\nma- teu ha ceryak aga-aga,\ntapi teu ajeh beket lega lok jerek.',
        subtitle:
          'Dia ingin menyeberang sungai\nuntuk mencari makanan,\ntetapi sungai itu terlalu luas dan dalam.',
        highlightWord: 'teu',
      },
      {
        image: scene1Kancil,
        text: 'Becog serngik keknit kernyim cennong.\nIlei abei rancangan ha alod bahyak-bahyak ajeh.',
        subtitle:
          'Kancil berfikir sejenak, kemudian tersenyum licik.\nDia mempunyai rancangan untuk memperdaya buaya-buaya itu.',
        highlightWord: 'bahyak',
      },
      {
        image: scene1Kancil,
        text: 'Lok tebek keyakinan,\nbecog cendot ku tebeg teu lok cig,\n"Hai, bahyak!"',
        subtitle:
          'Dengan penuh keyakinan,\nkancil berdiri di tebing sungai dan menjerit,\n"Hai, Buaya!"',
        highlightWord: 'cig',
      },
      {
        image: scene1Kancil,
        text: '"Eng angkot gah bor\nha engkek bahyak.\nRaja darat la mihun panei\nmegit jeoi bahyak ku teu adeh."',
        subtitle:
          '"Aku membawa berita baik untukmu.\nRaja hutan telah mengarahkan aku untuk mengira\nbanyaknya buaya di sungai ini."',
        highlightWord: 'raja',
      },
      {
        image: scene1Kancil,
        text: 'Bahyak-bahyak timbol lok mula berbaris\nku bug belengas ju nanek tebeg teu ma- tebeg teu de kilek.\nBecog bertej ma- keangin ayot bahyak petame lok mula mengira lok cegeh,\n"Nanek, due, nik..."',
        subtitle:
          'Buaya-buaya muncul dan mula berbaris di permukaan air.\nKancil melompat ke atas buaya pertama dan mula mengira dengan kuat,\n"Satu, dua, tiga..."',
        highlightWord: 'bertej',
      },
      {
        image: scene1Kancil,
        text: 'Telas hit ma- seberang,\nbecog lug lok pe,\n"Trima kaseh, bahyak!\nPadehal, eng pek ditugaskan ha mengira engkek.\nEng cume mihun dudau teu adeh."',
        subtitle:
          'Selepas sampai ke seberang,\nkancil ketawa dan berkata,\n"Terima kasih, Buaya!\nSebenarnya, aku tidak ditugaskan untuk mengira kamu.\nAku hanya perlu menyeberangi sungai ini."',
        highlightWord: 'trima',
      },
    ],
  },
  {
    id: 'santubong',
    title: 'Puteri Santubong',
    author: 'Cerite Sarawak',
    cover: imgSantubong,
    bg: bgSantubong,
    duration: '20 min',
    pages: 10,
    genre: 'Legend',
    synopsis:
      'Putri Santubong lok Putri Sejinjang ialah due angkot putri cagoh de abei sangkat mat-moh de tiada tenlug — legenda dua puteri kayangan Sarawak yang kecantikannya tiada tolok bandingnya, namun persahabatan mereka berakhir dalam pertelingkahan yang tragis.',
    lastChapter: 'Satu Cerite',
    lastPage: 1,
    totalPages: 10,
    progress: 0,
    scenes: [
      {
        image: scene1Santubong,
        text: 'PUTRI SANTUBONG\nLOK PUTRI SEJINJANG',
        subtitle: 'PUTERI SANTUBONG\nDAN PUTERI SEJINJANG',
        highlightWord: 'PUTRI',
      },
      {
        image: scene1Santubong,
        text: 'Putri Santubong lok Putri Sejinjang\nialah due angkot putri cagoh\nde abei sangkat mat-moh\nde tiada tenlug ba umor ajeh.',
        subtitle:
          'Puteri Santubong dan Puteri Sejinjang\nialah dua orang puteri dewa\nyang mempunyai paras rupa\nyang tiada tolok bandingnya ketika itu.',
        highlightWord: 'putri',
      },
      {
        image: scene1Santubong,
        text: 'Sangkat rimnar putri kenon cagoh ju kayangan ajeh\nbegei purnama kermik alam,\nsuara enai cukop perat\nbegei pensol awat.',
        subtitle:
          'Paras kedua-dua puteri anak dewa dari kayangan itu\nbagaikan purnama menghias alam,\nsuara mereka cukup merdu\nseperti seruling bambu.',
        highlightWord: 'suara',
      },
      {
        image: scene1Santubong,
        text: 'Putri Santubong lok Putri Sejinjang\nhad ramah arik.\nEnai beradek kebar.\nSenyuman lok keremmik asek batak kanyuk enai.',
        subtitle:
          'Puteri Santubong dan Puteri Sejinjang\namat mesra sekali.\nMereka seperti adik-beradik kembar.\nSenyuman dan kegembiraan sentiasa bermain di bibir mereka.',
        highlightWord: 'ramah',
      },
      {
        image: scene1Santubong,
        text: '"Sejinjang, telas selesei kerjak hik bai- adeh,\nhik batak-batak, ha-?"\ntanyak Putri Santubong ba Putri Sejinjang\nde asek seh bak.',
        subtitle:
          '"Sejinjang, selepas selesainya kerja kita berdua ini,\nkita bermain-main, mahu?"\ntanya Puteri Santubong kepada Puteri Sejinjang\nyang asyik menumbuk padi.',
        highlightWord: 'tanyak',
      },
      {
        image: scene1Santubong,
        text: 'Kerenjak Putri Santubong ju yahnah arik kelem\nhanyalah menenun abat.\nBeltop Putri Sejinjang asek lok seh bak.',
        subtitle:
          'Pekerjaan Puteri Santubong dari siang hingga malam\nhanyalah menenun kain.\nManakala Puteri Sejinjang pula asyik menumbuk padi.',
        highlightWord: 'kerenjak',
      },
      {
        image: scene1Santubong,
        text: 'Ba ajak arik, enai bertot lok acah adu cacat diri maseg-maseg.\nEnai memuji terloh diri ilei.',
        subtitle:
          'Pada suatu hari, mereka bergurau tentang kecantikan diri masing-masing.\nMereka memuji kelebihan diri sendiri.',
        highlightWord: 'bertot',
      },
      {
        image: scene1Santubong,
        text: 'Maseg-maseg ha- dipuji.\nJenawab antare Putri Santubong lok Putri Sejinjang gu- seep.\nMaseg-maseg pek kep pebiler nos enai arik.',
        subtitle:
          'Masing-masing mahu dipuji.\nPertengkaran antara Puteri Santubong dan Puteri Sejinjang semakin hangat.\nMasing-masing tidak dapat mengawal perasaan mereka lagi.',
        highlightWord: 'jenawab',
      },
      {
        image: scene1Santubong,
        text: 'Lok nos tebek dendam lok had belal,\nPutri Sejinjang leboh sabar laluk jabug Putri Santubong lok keneh ku teg.\nMenjeritlah Putri Santubong kerana urot.',
        subtitle:
          'Dengan perasaan penuh dendam dan amat marah,\nPuteri Sejinjang hilang sabar lalu menyerang Puteri Santubong dengan antan di tangan.\nMenus Puteri Santubong berteriak kerana kesakitan.',
        highlightWord: 'belal',
      },
      {
        image: scene1Santubong,
        text: 'As relei ajeh,\ncenan Santubong la bekah jadi due.\nDemikian balej, bukit Sejinjang bekah burei jadi pulau-pulau bacen.\nCerite sedeh adeh jadi kenangan rakyat Sarawak.',
        subtitle:
          'Akibat pergaduhan itu,\nGunung Santubong telah terpecah menjadi dua.\nDemikian juga, Bukit Sejinjang pecah menjadi pulau-pulau kecil.\nKisah sedih ini menjadi kenangan rakyat Sarawak.',
        highlightWord: 'cerite',
      },
    ],
  },
  {
    id: 'sunbe',
    title: 'Sunbe & Fenyi',
    author: 'SunMoon',
    cover: imgSunbeFenyi,
    bg: imgSunbeFenyi,
    duration: '1.5 hr',
    pages: 210,
    genre: 'Fable',
    synopsis:
      'SUNBE & FENYI: The Story of the Sun and Moon follows two siblings—Sunbe, the bold sun spirit, and Fenyi, the gentle moon—as they navigate their roles in the sky. When darkness threatens to swallow their world, they must learn that light is strongest when shared. A tale of sibling love, balance, and the rhythm of day and night.',
    lastChapter: 'Chapter 5 - Eclipse',
    lastPage: 140,
    totalPages: 210,
    progress: 67,
  },
  {
    id: 'fifine',
    title: 'Fifine & Imbo',
    author: 'FifBo',
    cover: imgFifineImbo,
    bg: imgFifineImbo,
    duration: '50 min',
    pages: 162,
    genre: 'Adventure',
    synopsis:
      'FIFINE & IMBO: The Tale of the Bat and Rat tells of an unlikely friendship between Fifine the bat and Imbo the rat, two creatures who only come out at night. Together they explore forgotten tunnels, ancient ruins, and moonlit forests, discovering that the world after dark is full of wonders—if you are brave enough to look. A story about friendship, curiosity, and finding beauty in unexpected places.',
    lastChapter: 'Chapter 2 - Moonlit Path',
    lastPage: 55,
    totalPages: 162,
    progress: 34,
  },
];
