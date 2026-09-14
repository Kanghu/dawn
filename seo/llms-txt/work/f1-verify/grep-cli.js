const fs=require("fs");
const dir="C:/Users/Dan/AppData/Roaming/npm/node_modules/@shopify/cli/dist/";
const file=process.argv[2], pat=process.argv[3], n=+(process.argv[4]||400);
const s=fs.readFileSync(dir+file,"utf8");
let i=-1,c=0;
while((i=s.indexOf(pat,i+1))>=0 && c<8){console.log("=== @"+i+"\n"+s.slice(Math.max(0,i-n),i+n)+"\n");c++}
