// Run with: DATABASE_URL=... npm run test:grader
// Checks every reference solution grades as correct, known-wrong queries fail, lenient variants pass,
// and the read-only guard rails hold.
import { runReadOnly, SqlError } from "../lib/db";
import { grade } from "../lib/grader";
import { QUESTIONS } from "../lib/questions";
import { SOLUTIONS } from "../lib/solutions";

let failures = 0;
const ok = (cond: boolean, label: string) => {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
};

async function check(id: string, sql: string, shouldPass: boolean, label: string) {
  const sol = SOLUTIONS[id];
  const expected = await runReadOnly(sol.sql, 5000);
  let correct = false;
  let msg = "";
  try {
    const her = await runReadOnly(sql, 1000);
    const g = grade(expected, her, sol.orderBy);
    correct = g.correct;
    msg = [...g.messages, g.orderNote ?? ""].join(" ").trim();
  } catch (e) {
    msg = `error: ${(e as Error).message}`;
  }
  ok(correct === shouldPass, `${id}: ${label}${msg ? `  [${msg.slice(0, 140)}]` : ""}`);
}

async function main() {
  // 1. Every question has a solution, and every solution grades itself as correct.
  for (const q of QUESTIONS) {
    const sol = SOLUTIONS[q.id];
    ok(!!sol, `${q.id}: has a solution`);
    if (!sol) continue;
    const r = await runReadOnly(sol.sql, 5000);
    ok(r.rowCount > 0, `${q.id}: reference returns ${r.rowCount} rows, ${r.columns.length} cols`);
    await check(q.id, sol.sql, true, "reference solution passes");
  }
  ok(Object.keys(SOLUTIONS).length === QUESTIONS.length, "no orphan solutions");

  // 2. Lenient variants that should pass.
  await check("todays-menu", "select current_price as price, item_name as drink, category from menu_items where retired_date is null order by 1 desc", true, "reordered + aliased + extra column");
  await check("todays-menu", "SELECT item_name, current_price FROM menu_items WHERE retired_date IS NULL", true, "missing ORDER BY still passes (with note)");
  await check("drink-cost-today", `SELECT m.item_name, SUM(r.quantity * i.current_unit_cost) AS c, m.current_price,
      m.current_price - SUM(r.quantity * i.current_unit_cost) AS p
      FROM menu_items m JOIN recipe_ingredients r USING (menu_item_id) JOIN inventory_items i USING (inventory_item_id)
      WHERE m.retired_date IS NULL GROUP BY 1, 3`, true, "unrounded cost");
  await check("genre-trend", `SELECT g.genre_name,
      SUM(CASE WHEN EXTRACT(YEAR FROM o.order_ts)=2023 THEN obi.quantity END) a,
      SUM(CASE WHEN EXTRACT(YEAR FROM o.order_ts)=2025 THEN obi.quantity END) b,
      ROUND((SUM(CASE WHEN EXTRACT(YEAR FROM o.order_ts)=2025 THEN obi.quantity END) - SUM(CASE WHEN EXTRACT(YEAR FROM o.order_ts)=2023 THEN obi.quantity END)) * 100.0
        / SUM(CASE WHEN EXTRACT(YEAR FROM o.order_ts)=2023 THEN obi.quantity END), 2) pct
      FROM order_book_items obi JOIN orders o USING (order_id) JOIN books b USING (book_id) JOIN genres g USING (genre_id)
      GROUP BY 1`, true, "CASE WHEN pivot, 2-decimal pct");
  await check("zero-fill-months", `SELECT mo, c.category, COALESCE(SUM(oci.unit_price * oci.quantity), 0)
      FROM generate_series('2025-01-01'::timestamp, '2025-12-01', '1 month') mo
      CROSS JOIN (SELECT DISTINCT category FROM menu_items) c
      LEFT JOIN (SELECT DATE_TRUNC('month', o.order_ts) AS mon, m.category, oci.unit_price, oci.quantity
                 FROM order_coffee_items oci JOIN orders o USING (order_id) JOIN menu_items m USING (menu_item_id)) oci
        ON oci.mon = mo AND oci.category = c.category
      GROUP BY 1, 2`, true, "timestamp months, different approach");
  await check("managers", `SELECT CONCAT(e.first_name, ' ', e.last_name), CONCAT(m.first_name, ' ', m.last_name)
      FROM employees e LEFT JOIN employees m ON m.employee_id = e.manager_id`, true, "CONCAT gives '' for owner's manager");
  await check("coworker-pairs", `SELECT b.first_name || ' ' || b.last_name, a.first_name || ' ' || a.last_name, s.store_name
      FROM employees a JOIN employees b ON a.store_id = b.store_id AND a.employee_id > b.employee_id
      JOIN stores s ON s.store_id = a.store_id`, true, "pairs flipped with >");
  await check("genre-sales-2025", `SELECT g.genre_name, COALESCE(SUM(obi.quantity), 0)
      FROM genres g
      LEFT JOIN books b ON b.genre_id = g.genre_id
      LEFT JOIN (order_book_items obi JOIN orders o ON o.order_id = obi.order_id
                 AND o.order_ts >= '2025-01-01' AND o.order_ts < '2026-01-01') ON obi.book_id = b.book_id
      GROUP BY g.genre_name`, true, "filter in the ON clause");
  await check("never-ordered-count", "SELECT COUNT(*) FROM customers WHERE customer_id NOT IN (SELECT customer_id FROM orders WHERE customer_id IS NOT NULL)", true, "NOT IN subquery");
  await check("matcha-by-year", `SELECT date_part('year', o.order_ts), SUM(quantity), SUM(unit_price*quantity), SUM((unit_price-unit_cost)*quantity)
      FROM order_coffee_items JOIN orders o USING (order_id) WHERE menu_item_id = 15 GROUP BY 1`, true, "date_part + id instead of name");
  await check("loyalty-value", `WITH t AS (SELECT order_id, SUM(unit_price*quantity) v FROM (SELECT order_id, unit_price, quantity FROM order_coffee_items UNION ALL SELECT order_id, unit_price, quantity FROM order_book_items) x GROUP BY 1)
      SELECT c.loyalty_tier, AVG(t.v), COUNT(*)::numeric / COUNT(DISTINCT o.customer_id)
      FROM orders o JOIN t USING (order_id) JOIN customers c USING (customer_id) GROUP BY 1`, true, "unrounded averages");
  await check("rush-hour", `SELECT DISTINCT ON (s.store_name) s.store_name, EXTRACT(HOUR FROM o.order_ts), COUNT(*)
      FROM orders o JOIN stores s USING (store_id) GROUP BY 1, 2 ORDER BY s.store_name, 3 DESC`, true, "DISTINCT ON");
  await check("mom-change", `SELECT DATE_TRUNC('month', o.order_ts) m, SUM(unit_price*quantity) r,
      SUM(unit_price*quantity) - LAG(SUM(unit_price*quantity)) OVER (ORDER BY DATE_TRUNC('month', o.order_ts))
      FROM order_coffee_items JOIN orders o USING (order_id) WHERE o.order_ts >= '2025-01-01' AND o.order_ts < '2026-01-01' GROUP BY 1 ORDER BY 1`, true, "timestamp month, no CTE");

  // 3. Wrong answers that should fail.
  await check("todays-menu", "SELECT item_name, current_price FROM menu_items", false, "forgot retired filter");
  await check("unused-ingredients", `SELECT i.item_name, COUNT(*) FROM inventory_items i LEFT JOIN recipe_ingredients r ON r.inventory_item_id = i.inventory_item_id GROUP BY 1`, false, "COUNT(*) after LEFT JOIN");
  await check("genre-sales-2025", `SELECT g.genre_name, COALESCE(SUM(obi.quantity),0) FROM genres g LEFT JOIN books b ON b.genre_id=g.genre_id
      LEFT JOIN order_book_items obi ON obi.book_id=b.book_id LEFT JOIN orders o ON o.order_id=obi.order_id
      WHERE o.order_ts >= '2025-01-01' AND o.order_ts < '2026-01-01' GROUP BY 1`, false, "WHERE filter drops Poetry");
  await check("genre-trend", `SELECT g.genre_name,
      SUM(obi.quantity) FILTER (WHERE EXTRACT(YEAR FROM o.order_ts)=2023),
      SUM(obi.quantity) FILTER (WHERE EXTRACT(YEAR FROM o.order_ts)=2025),
      100 * (SUM(obi.quantity) FILTER (WHERE EXTRACT(YEAR FROM o.order_ts)=2025) - SUM(obi.quantity) FILTER (WHERE EXTRACT(YEAR FROM o.order_ts)=2023))
        / SUM(obi.quantity) FILTER (WHERE EXTRACT(YEAR FROM o.order_ts)=2023)
      FROM order_book_items obi JOIN orders o USING (order_id) JOIN books b USING (book_id) JOIN genres g USING (genre_id) GROUP BY 1`, false, "integer division");
  await check("store-showdown", `SELECT s.store_name,
      SUM((oci.unit_price-oci.unit_cost)*oci.quantity) + SUM((obi.unit_price-obi.unit_cost)*obi.quantity),
      ROUND(100*SUM(obi.unit_price*obi.quantity)/(SUM(oci.unit_price*oci.quantity)+SUM(obi.unit_price*obi.quantity)),1)
      FROM orders o JOIN stores s USING (store_id)
      LEFT JOIN order_coffee_items oci ON oci.order_id=o.order_id LEFT JOIN order_book_items obi ON obi.order_id=o.order_id
      WHERE o.order_ts >= '2025-01-01' AND o.order_ts < '2026-01-01' GROUP BY 1`, false, "double-counting fan-out join");
  await check("item-suppliers", `SELECT i.item_name, s.supplier_name FROM inventory_items i JOIN suppliers s USING (supplier_id)`, false, "INNER JOIN drops honey");
  await check("item-suppliers", `SELECT i.item_name, s.supplier_name FROM inventory_items i LEFT JOIN suppliers s USING (supplier_id)`, false, "NULL instead of 'No supplier'");
  await check("losing-2025", `SELECT m.item_name, SUM((unit_price-unit_cost)*quantity) FROM order_coffee_items JOIN menu_items m USING (menu_item_id) GROUP BY 1 HAVING SUM((unit_price-unit_cost)*quantity) < 2000`, false, "wrong year and threshold");
  await check("book-catalog", `SELECT g.genre_name, b.title, a.author_name FROM books b JOIN authors a ON a.author_id = b.genre_id JOIN genres g ON g.genre_id = b.genre_id`, false, "joined on the wrong id");

  // 4. Guard rails.
  const expectError = async (sql: string, label: string, re: RegExp) => {
    try {
      await runReadOnly(sql, 1000);
      ok(false, `guard: ${label} (no error)`);
    } catch (e) {
      ok(e instanceof SqlError && re.test((e as Error).message), `guard: ${label} -> ${(e as Error).message.slice(0, 90)}`);
    }
  };
  await expectError("DELETE FROM orders", "DELETE blocked", /read-only|permission/i);
  await expectError("UPDATE books SET list_price = 0", "UPDATE blocked", /read-only|permission/i);
  await expectError("CREATE TABLE sandbox.x (id int)", "CREATE blocked", /read-only|permission/i);
  await expectError("SELECT 1; DELETE FROM orders", "multiple statements blocked", /one query/i);
  await expectError("COMMIT; CREATE TABLE sandbox.y (id int)", "COMMIT escape blocked", /one query/i);
  await expectError("SELECT pg_sleep(20)", "timeout enforced", /stopped/i);
  await expectError("SELECT * FROM auth.users", "other schemas not readable", /does not exist|permission/i);
  const big = await runReadOnly("SELECT a.order_id, b.order_id FROM orders a CROSS JOIN orders b", 1000);
  ok(big.truncated && big.rowCount === 1000, "guard: huge CROSS JOIN is capped at 1000 rows");
  const after = await runReadOnly("SELECT current_setting('transaction_read_only') ro, current_user", 10);
  ok(after.rows[0][0] === "on" && after.rows[0][1] === "sql_student", `guard: still read-only as ${after.rows[0][1]}`);

  console.log(failures ? `\n${failures} FAILED` : "\nAll checks passed.");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
