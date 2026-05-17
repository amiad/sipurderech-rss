const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

async function createRssFeed() {
  const url = "https://www.sipurderech.co.il/%D7%99%D7%A9%D7%A8%D7%90%D7%9C";
  const config = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  };

  try {
    const response = await axios.get(url, config);
    const $ = cheerio.load(response.data);

    let articlesXml = '';

    // ריצה על כל הדיבים שמתאימים למבנה של הכרטיסייה
    $('div.flex.flex-col').each((index, element) => {
      const card = $(element);
      const titleTag = card.find('h3');
      const descTag = card.find('p');

      // וידוא שאנחנו אכן על כרטיסיית מסלול עם כותרת ותיאור
      if (titleTag.length && descTag.length) {
        const title = titleTag.text().trim();
        const description = descTag.text().trim();

        // חילוץ שם הכותב
        const authorTag = card.find('span.text-muted-foreground');
        const author = authorTag.length ? authorTag.text().trim() : 'מערכת האתר';

        // חיפוש אלמנט הקישור (האב) והתמונה
        let link = 'https://www.sipurderech.co.il/ישראל';
        let imageUrl = '';

        const parentA = card.closest('a');
        if (parentA.length && parentA.attr('href')) {
          link = `https://www.sipurderech.co.il${parentA.attr('href')}`;
          
          const imgTag = parentA.find('img');
          if (imgTag.length && imgTag.attr('src')) {
            imageUrl = imgTag.attr('src');
          }
        }

        // בניית התיאור המשולב (כולל תמונה לקוראי RSS)
        let fullDescription = '';
        if (imageUrl) {
          fullDescription += `&lt;img src="${imageUrl}" alt="${title}" /&gt;&lt;br/&gt;`;
        }
        fullDescription += `&lt;p&gt;${description}&lt;/p&gt;&lt;p&gt;&lt;strong&gt;כותב:&lt;/strong&gt; ${author}&lt;/p&gt;`;

        const pubDate = new Date().toUTCString();

        // הוספת הפריט ל-XML
        articlesXml += `
    <item>
      <title><![CDATA[${title}]]></title>
      <link>${link}</link>
      <author><![CDATA[${author}]]></author>
      <description><![CDATA[${fullDescription}]]></description>
      <pubDate>${pubDate}</pubDate>
      ${imageUrl ? `<enclosure url="${imageUrl}" type="image/jpeg" />` : ''}
    </item>`;
      }
    });

    // הרכבת קובץ ה-RSS המלא
    const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>סיפור דרך - מסלולים בישראל</title>
    <link>https://www.sipurderech.co.il/ישראל</link>
    <description>פיד מסלולים וטרקים מעודכן אוטומטית</description>
    <language>he</language>${articlesXml}
  </channel>
</rss>`;

    fs.writeFileSync('feed.xml', rssFeed, 'utf-8');
    console.log('Feed updated successfully.');

  } catch (error) {
    console.error('Error generating RSS feed:', error.message);
    process.exit(1);
  }
}

createRssFeed();
