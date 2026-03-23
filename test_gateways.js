
const gateways = [
  "https://ipfs.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/", 
  "https://nftstorage.link/ipfs/",
  "https://4everland.io/ipfs/",
  "https://dweb.link/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

const cid = "bafybeibwzifw52ttrkqlikfzext5akxkniq3hq75j6vswrgbwxxcfqhxqm";

async function test() {
  console.log("Testing gateways...");
  const results = [];
  
  for (const gateway of gateways) {
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const res = await fetch(`${gateway}${cid}`, { 
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      
      if (res.ok) {
        results.push({ gateway, time: Math.round(performance.now() - start), status: 'OK' });
      } else {
        results.push({ gateway, time: Math.round(performance.now() - start), status: res.status });
      }
    } catch (e) {
      results.push({ gateway, time: Math.round(performance.now() - start), status: 'Fail/Timeout' });
    }
  }
  
  console.table(results.sort((a, b) => {
    if (a.status === 'OK' && b.status !== 'OK') return -1;
    if (a.status !== 'OK' && b.status === 'OK') return 1;
    return a.time - b.time;
  }));
}

test();
