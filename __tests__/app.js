const request = require("supertest");
var cheerio = require("cheerio");
const db = require("../models/index");
const app = require("../app");

let server, agent;
function extractCSRFToken(res) {
  var $ = cheerio.load(res.text);
  return $("[name=_csrf]").val();
}

const login = async (agent, username, password) => {
  let res = await agent.get("/login");
  let csrfToken = extractCSRFToken(res);
  res = await agent.post("/session").send({
    email: username,
    password,
    _csrf: csrfToken,
  });
};

describe("Learning Management Application", function () {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    server = app.listen(4000, () => {});
    agent = request.agent(server);
  });

  afterAll(async () => {
    try {
      await db.sequelize.close();
      await server.close();
    } catch (error) {
      console.log(error);
    }
  });

  test("Sign up testing", async () => {
    let res = await agent.get("/educatorSignup");
    const csrfToken = extractCSRFToken(res);
    res = await agent.post("/user").send({
      firstName: "Test",
      lastName: "User A",
      email: "usera@gmail.com",
      password: "userARocks",
      designation: "educator",
      _csrf: csrfToken,
    });
    expect(res.statusCode).toBe(302);
  });

  test("Sign out test", async () => {
    let res = await agent.get("/login");
    expect(res.statusCode).toBe(200);
    res = await agent.get("/signout");
    expect(res.statusCode).toBe(302);
    res = await agent.get("/home");
    expect(res.statusCode).toBe(302);
  });

  test("Create a course", async () => {
    const agent = request.agent(server);
    await login(agent, "usera@gmail.com", "userARocks");
    const csrfToken = extractCSRFToken(await agent.get("/login"));
    let res = await agent.post("/course").send({
      _csrf: csrfToken,
      name: "Python Language Course",
      description: "Comprehensive course on python",
    });
    expect(res.text.includes("/home")).toBe(true);
    expect(res.statusCode).toBe(302);
  });

  test("Deletes a course", async () => {
    const agent = request.agent(server);
    await login(agent, "usera@gmail.com", "userARocks");
    const csrfToken = extractCSRFToken(await agent.get("/login"));
    let res = await agent.delete("/course").send({
      _csrf: csrfToken,
      id: 1,
    });
    expect(res.text.includes("/home")).toBe(true);
    expect(res.statusCode).toBe(302);
  });
});
