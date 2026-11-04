import assert from "node:assert/strict";
import { test } from "node:test";
import { candidates, Search } from "../src/core/toolchain";

const search = (over: Partial<Search>): Search => ({
  configured: "",
  folders: [],
  env: {},
  home: "/home/me",
  platform: "linux",
  ...over,
});

test("the setting alone is used when it is set", () => {
  assert.deepEqual(candidates(search({ configured: "/opt/j/jelloc", folders: ["/w"] })), [
    { jelloc: "/opt/j/jelloc" },
  ]);
});

test("a checkout's own build and stdlib come before installed tools", () => {
  const found = candidates(
    search({ folders: ["/w"], env: { JELLO_ROOT: "/r", PATH: "/usr/bin:/bin" } }),
  );
  assert.deepEqual(found, [
    { jelloc: "/w/vm/build/jelloc", std: "/w/stdlib" },
    { jelloc: "/r/bin/jelloc" },
    { jelloc: "/usr/bin/jelloc" },
    { jelloc: "/bin/jelloc" },
    { jelloc: "/home/me/.jello/current/bin/jelloc" },
  ]);
});

test("Windows names jelloc.exe, splits PATH on ; and looks in LOCALAPPDATA", () => {
  const found = candidates(
    search({
      platform: "win32",
      home: "C:\\Users\\me",
      env: { PATH: "C:\\a;C:\\b", LOCALAPPDATA: "C:\\Users\\me\\AppData\\Local" },
    }),
  );
  assert.deepEqual(
    found.map((c) => c.jelloc),
    [
      "C:\\a\\jelloc.exe",
      "C:\\b\\jelloc.exe",
      "C:\\Users\\me\\.jello\\current\\bin\\jelloc.exe",
      "C:\\Users\\me\\AppData\\Local\\jello\\current\\bin\\jelloc.exe",
    ],
  );
});
