import fetch from "node-fetch";

async function run() {
  try {
    const res = await fetch("http://localhost:3000/api/story/image", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ prompt: "A spooky ghost", mood: "scary" })
    });
    console.log(res.status);
    console.log(await res.text());
  } catch (e) {
    console.error(e);
  }
}
run();
