export default function Guide() {
  return (
    <div className="guide">
      <h2>Money formulas</h2>
      <dl className="formulas">
        <div>
          <dt>Revenue</dt>
          <dd>
            <code>unit_price * quantity</code>
          </dd>
        </div>
        <div>
          <dt>Cost</dt>
          <dd>
            <code>unit_cost * quantity</code>
          </dd>
        </div>
        <div>
          <dt>Profit</dt>
          <dd>
            <code>(unit_price - unit_cost) * quantity</code>
          </dd>
        </div>
        <div>
          <dt>Margin %</dt>
          <dd>profit ÷ revenue × 100</dd>
        </div>
      </dl>
      <p>
        On sales lines, <code>unit_price</code> is what the customer actually paid (after any promotion) and{' '}
        <code>unit_cost</code> is what the item cost the shop at the time.
      </p>

      <h2>Joins</h2>
      <dl className="joins">
        <div>
          <dt>INNER JOIN</dt>
          <dd>Only rows that match on both sides.</dd>
        </div>
        <div>
          <dt>LEFT JOIN</dt>
          <dd>Every row from the left table, with NULLs where the right side has no match.</dd>
        </div>
        <div>
          <dt>FULL JOIN</dt>
          <dd>Every row from both sides, with NULLs wherever there’s no match.</dd>
        </div>
        <div>
          <dt>CROSS JOIN</dt>
          <dd>Every left row paired with every right row. No ON clause. 5 rows × 4 rows = 20 rows.</dd>
        </div>
        <div>
          <dt>Self join</dt>
          <dd>
            A table joined to itself with two aliases, like <code>employees e JOIN employees mgr</code>.
          </dd>
        </div>
      </dl>

      <h2>Patterns worth knowing</h2>
      <h3>Find things that never happened</h3>
      <pre>{`SELECT a.*
FROM table_a a
LEFT JOIN table_b b ON b.a_id = a.id
WHERE b.a_id IS NULL;`}</pre>
      <h3>Replace NULL with a label</h3>
      <pre>{`COALESCE(c.loyalty_tier, 'Walk-in')`}</pre>
      <h3>Turn years into columns</h3>
      <pre>{`SUM(quantity) FILTER (
  WHERE EXTRACT(YEAR FROM order_ts) = 2025
) AS sold_2025`}</pre>
      <h3>Stack two similar tables</h3>
      <pre>{`SELECT order_id, unit_price, quantity
FROM order_coffee_items
UNION ALL
SELECT order_id, unit_price, quantity
FROM order_book_items`}</pre>
      <h3>Group by month</h3>
      <pre>{`DATE_TRUNC('month', order_ts)`}</pre>

      <h2>Common traps</h2>
      <ul className="traps">
        <li>
          A <code>WHERE</code> filter on the right table of a LEFT JOIN turns it back into an INNER JOIN. Put that condition in
          the <code>ON</code> clause, or filter in a subquery first.
        </li>
        <li>
          <code>COUNT(*)</code> counts rows. <code>COUNT(column)</code> skips NULLs. After a LEFT JOIN, count a column from the
          right table.
        </li>
        <li>
          <code>WHERE</code> filters rows before grouping. <code>HAVING</code> filters groups after.
        </li>
        <li>
          Joining two “many” tables to the same parent (orders → drinks and orders → books) multiplies rows and inflates sums.
          Total each one separately, then join the totals.
        </li>
        <li>
          <code>order_ts &lt; &apos;2026-01-01&apos;</code> is safer than <code>&lt;= &apos;2025-12-31&apos;</code> because{' '}
          <code>order_ts</code> includes a time.
        </li>
        <li>
          <code>100 * a / b</code> with whole numbers drops the decimals. Use <code>100.0</code>.
        </li>
      </ul>

      <h2>How grading works</h2>
      <p>
        Your result is compared with the reference answer’s result. Column names and column order don’t matter, extra columns
        are fine, and numbers only need to match to the precision shown in the answer. The rows have to match.
      </p>
      <p>Your progress is saved in this browser.</p>
    </div>
  );
}
