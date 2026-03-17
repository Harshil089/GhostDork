import { queryShodanHost, resolveDomainToIp } from "./lib/api/shodan";
import { queryCrtsh } from "./lib/api/crtsh";

async function runTests() {
  console.log("=== Testing crt.sh ===");
  try {
    const crtResult = await queryCrtsh("ghostdork.com");
    console.log(`Found ${crtResult.subdomains.length} subdomains for ghostdork.com`);
    console.log("Sample:", crtResult.subdomains.slice(0, 3));
  } catch (err) {
    console.error("crt.sh error:", err);
  }

  console.log("\n=== Testing Shodan ===");
  try {
    const domain = "scanme.nmap.org";
    console.log(`Resolving ${domain} to IP...`);
    const ip = await resolveDomainToIp(domain);
    console.log(`Resolved IP: ${ip}`);
    
    if (ip) {
      console.log(`Querying Shodan for IP ${ip}...`);
      const shodanResult = await queryShodanHost(ip);
      if (shodanResult) {
        console.log(`Shodan Success!`);
        console.log(`IP: ${shodanResult.ip_str}`);
        console.log(`Ports:`, shodanResult.ports);
        console.log(`OS:`, shodanResult.os);
        console.log(`Org:`, shodanResult.org);
      } else {
        console.log(`No Shodan results found for ${ip}`);
      }
    }
  } catch (err) {
    console.error("Shodan error:", err);
  }
}

runTests();
