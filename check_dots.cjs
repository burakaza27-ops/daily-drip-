const fs = require('fs');
const data = JSON.parse(fs.readFileSync('src/data/anaphoras/hawaryat.json', 'utf8'));

let results = [];
data.forEach(item => {
  let hasDots = false;
  for(let key in item) {
    if(typeof item[key] === 'string' && item[key].includes('...')) {
      hasDots = true;
    }
  }
  if(hasDots) {
    results.push({ id: item.id, part: item.liturgy_part });
  }
});
console.log(JSON.stringify(results, null, 2));
