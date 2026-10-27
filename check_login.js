async function test() {
  const res = await fetch("http://localhost:3000/api/auth/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@freshveggies.com",
      password: "admin123"
    })
  });
  const data = await res.json();
  console.log("LOGIN RESULT:", JSON.stringify(data));
}
test();
