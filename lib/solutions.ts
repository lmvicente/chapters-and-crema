import 'server-only';

// Server-only: reference solutions and the "what this tells the business" insight.
// These are never sent to the browser until the question is solved (or revealed).
//
// Grading compares her result to the solution's result. Each solution returns only
// the columns the question asks for; extra columns in her answer are allowed,
// column names and column order don't matter, and numbers are compared at the
// precision the solution shows.
//
// orderBy: [expected column index, direction] pairs, used only to add a note when
// the question asks for a sort order and her rows aren't in it.

export type Solution = {
  sql: string;
  insight: string;
  orderBy?: [number, 'asc' | 'desc'][];
  orderHint?: string;
};

export const SOLUTIONS: Record<string, Solution> = {
  'todays-menu': {
    sql: `SELECT item_name, current_price
FROM menu_items
WHERE retired_date IS NULL
ORDER BY current_price DESC;`,
    orderBy: [[1, 'desc']],
    orderHint: 'most expensive first',
    insight: 'Matcha Latte is now the priciest drink at $6.75, and that price only went up in August 2026. The business questions later show why the owner had to raise it.',
  },
  reorder: {
    sql: `SELECT item_name, quantity_on_hand, reorder_level,
       reorder_level - quantity_on_hand AS units_short
FROM inventory_items
WHERE quantity_on_hand < reorder_level;`,
    insight: 'Reorder reports are one of the most common queries in any shop. Look twice at Vanilla Ice Cream, though: the LEFT JOIN section shows no current drink uses it, so reordering it would be wasted money.',
  },
  'out-of-stock': {
    sql: `SELECT title
FROM books
WHERE quantity_on_hand = 0;`,
    insight: 'Fourth Wing and It Ends with Us are both out of stock, and they turn out to be two of the three best-selling books. Stockouts on best sellers are lost revenue, which makes this a classic analyst finding.',
  },
  'payment-trend': {
    sql: `SELECT EXTRACT(YEAR FROM order_ts) AS year, payment_method, COUNT(*) AS orders
FROM orders
GROUP BY 1, 2
ORDER BY 1, 2;`,
    insight: 'Cash fell from about 13% of orders in 2023 to under 7% in 2026, while mobile kept growing. Trends like this are what justify decisions such as going cashless or investing in mobile ordering.',
  },

  'book-catalog': {
    sql: `SELECT g.genre_name, b.title, a.author_name
FROM books b
JOIN authors a ON a.author_id = b.author_id
JOIN genres  g ON g.genre_id  = b.genre_id
ORDER BY g.genre_name, b.title;`,
    insight: 'This is the core move of relational data: IDs in one table, names in another. Nearly every report starts by joining lookup tables like authors and genres.',
  },
  'macchiato-ingredients': {
    sql: `SELECT i.item_name, r.quantity, i.unit
FROM menu_items m
JOIN recipe_ingredients r ON r.menu_item_id = m.menu_item_id
JOIN inventory_items   i ON i.inventory_item_id = r.inventory_item_id
WHERE m.item_name = 'Caramel Macchiato';`,
    insight: 'recipe_ingredients is a junction table: it links drinks to inventory items in a many-to-many relationship. It\'s also the table you\'ll use to work out what each drink costs to make.',
  },
  'macchiato-steps': {
    sql: `SELECT s.step_number, s.instruction
FROM menu_items m
JOIN recipe_steps s ON s.menu_item_id = m.menu_item_id
WHERE m.item_name = 'Caramel Macchiato'
ORDER BY s.step_number;`,
    orderBy: [[0, 'asc']],
    orderHint: 'in step order',
    insight: 'Storing one row per step means the steps can be sorted, edited, or reused one at a time. Point-of-sale and recipe systems store instructions the same way.',
  },
  'drink-cost-today': {
    sql: `SELECT m.item_name,
       ROUND(SUM(r.quantity * i.current_unit_cost), 2)                   AS cost_to_make,
       m.current_price,
       ROUND(m.current_price - SUM(r.quantity * i.current_unit_cost), 2) AS profit_per_drink
FROM menu_items m
JOIN recipe_ingredients r ON r.menu_item_id = m.menu_item_id
JOIN inventory_items   i ON i.inventory_item_id = r.inventory_item_id
WHERE m.retired_date IS NULL
GROUP BY m.item_name, m.current_price
ORDER BY profit_per_drink;`,
    insight: 'Matcha Latte costs about $5.97 to make and earns only 78¢ a drink, while most espresso drinks earn $3–4. Per-unit profit like this (unit economics) is one of the first things an analyst checks on a product line.',
  },
  'category-revenue-2025': {
    sql: `SELECT m.category,
       SUM(oci.quantity)                  AS drinks_sold,
       SUM(oci.unit_price * oci.quantity) AS revenue
FROM order_coffee_items oci
JOIN orders     o ON o.order_id = oci.order_id
JOIN menu_items m ON m.menu_item_id = oci.menu_item_id
WHERE o.order_ts >= '2025-01-01' AND o.order_ts < '2026-01-01'
GROUP BY m.category
ORDER BY revenue DESC;`,
    insight: 'Espresso drinks brought in about $36k in 2025, more than every other category combined. Any pricing or menu change there moves the whole business.',
  },
  'top-books': {
    sql: `SELECT b.title, a.author_name, SUM(obi.quantity) AS copies_sold
FROM order_book_items obi
JOIN books   b ON b.book_id   = obi.book_id
JOIN authors a ON a.author_id = b.author_id
GROUP BY b.title, a.author_name
ORDER BY copies_sold DESC
LIMIT 5;`,
    orderBy: [[2, 'desc']],
    orderHint: 'best seller first',
    insight: 'Fantasy and romance own the top of the list, led by Fourth Wing. Combine this with the out-of-stock question and you have a strong case to reorder those titles now.',
  },
  'supplier-spend': {
    sql: `SELECT s.supplier_name, ROUND(SUM(p.quantity * p.unit_cost), 2) AS total_spent
FROM inventory_purchases p
JOIN suppliers s ON s.supplier_id = p.supplier_id
GROUP BY s.supplier_name
ORDER BY total_spent DESC;`,
    orderBy: [[1, 'desc']],
    orderHint: 'biggest first',
    insight: 'Coffee beans from Valley Roasters are the biggest cost by far. When bean prices rose about 40% between 2023 and 2026, this is the line where it showed up first.',
  },
  'staff-orders-2025': {
    sql: `SELECT e.first_name, e.last_name, s.store_name, COUNT(*) AS orders
FROM orders o
JOIN employees e ON e.employee_id = o.employee_id
JOIN stores    s ON s.store_id    = o.store_id
WHERE o.order_ts >= '2025-01-01' AND o.order_ts < '2026-01-01'
GROUP BY e.first_name, e.last_name, s.store_name
ORDER BY orders DESC;`,
    insight: 'Shift leads and baristas carry the volume; managers and booksellers ring up far fewer orders. Downtown\'s baristas each handled about 2,000 orders, which is the kind of number used to decide where the next hire goes.',
  },

  'unused-ingredients': {
    sql: `SELECT i.item_name, COUNT(r.menu_item_id) AS used_in_drinks
FROM inventory_items i
LEFT JOIN recipe_ingredients r ON r.inventory_item_id = i.inventory_item_id
GROUP BY i.item_name
ORDER BY used_in_drinks, i.item_name;`,
    insight: 'Cleaning supplies, napkins, bags, and almond milk aren\'t in any recipe, so they never show up in a drink\'s cost. That\'s overhead: real money that cost-per-drink numbers leave out.',
  },
  'unsold-books': {
    sql: `SELECT b.title
FROM books b
LEFT JOIN order_book_items obi ON obi.book_id = b.book_id
WHERE obi.book_id IS NULL;`,
    insight: 'Both books were added in late September 2026, so they\'re new, not flops. Always check when something started before calling it a failure.',
  },
  'empty-genre': {
    sql: `SELECT g.genre_name
FROM genres g
LEFT JOIN books b ON b.genre_id = g.genre_id
WHERE b.book_id IS NULL;`,
    insight: 'Poetry is set up as a genre but has no books. Gaps like this are easy to miss without a LEFT JOIN, and they\'re often a sign of a category someone planned and never stocked.',
  },
  'genre-sales-2025': {
    sql: `WITH sold_2025 AS (
    SELECT b.genre_id, SUM(obi.quantity) AS copies
    FROM order_book_items obi
    JOIN orders o ON o.order_id = obi.order_id
    JOIN books  b ON b.book_id  = obi.book_id
    WHERE o.order_ts >= '2025-01-01' AND o.order_ts < '2026-01-01'
    GROUP BY b.genre_id
)
SELECT g.genre_name, COALESCE(s.copies, 0) AS copies
FROM genres g
LEFT JOIN sold_2025 s ON s.genre_id = g.genre_id
ORDER BY copies DESC;`,
    insight: 'Poetry shows 0 only because you started from genres. Putting the date filter in WHERE would have silently dropped it. That trap is one of the most common bugs in real reports.',
  },
  'never-ordered-count': {
    sql: `SELECT COUNT(*) AS never_ordered
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.order_id IS NULL;`,
    insight: '23 people signed up and never bought anything. Marketing would call this a win-back list.',
  },
  'never-ordered-earliest': {
    sql: `SELECT c.first_name, c.last_name, c.join_date
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.order_id IS NULL
ORDER BY c.join_date
LIMIT 5;`,
    orderBy: [[2, 'asc']],
    orderHint: 'earliest join date first',
    insight: 'Two of these customers have been members since 2022 without a single order. In a real shop you\'d check whether something went wrong with signups or welcome offers around then.',
  },
  'item-suppliers': {
    sql: `SELECT i.item_name, COALESCE(s.supplier_name, 'No supplier') AS supplier
FROM inventory_items i
LEFT JOIN suppliers s ON s.supplier_id = i.supplier_id
ORDER BY supplier, i.item_name;`,
    insight: 'Local Honey comes from the farmers market, so it has no supplier. An INNER JOIN silently drops it, which is why it\'s worth checking row counts after every join.',
  },
  'dead-supplier': {
    sql: `SELECT s.supplier_name
FROM suppliers s
LEFT JOIN inventory_items i ON i.supplier_id = s.supplier_id
LEFT JOIN books           b ON b.supplier_id = s.supplier_id
WHERE i.inventory_item_id IS NULL
  AND b.book_id IS NULL;`,
    insight: 'Mountain Spring Tea Traders is still in the supplier list but supplies nothing. Cleaning up stale records like this keeps reports and vendor audits accurate.',
  },
  'tier-orders': {
    sql: `SELECT COALESCE(c.loyalty_tier, 'Walk-in') AS tier, COUNT(*) AS orders
FROM orders o
LEFT JOIN customers c ON c.customer_id = o.customer_id
GROUP BY COALESCE(c.loyalty_tier, 'Walk-in')
ORDER BY orders DESC;`,
    insight: 'More than half of all orders are walk-ins with no loyalty account. Getting even some of them to sign up is an obvious growth lever.',
  },

  'drinks-2023-vs-2025': {
    sql: `WITH y2023 AS (
    SELECT oci.menu_item_id, SUM(oci.quantity) AS sold
    FROM order_coffee_items oci
    JOIN orders o ON o.order_id = oci.order_id
    WHERE o.order_ts >= '2023-01-01' AND o.order_ts < '2024-01-01'
    GROUP BY oci.menu_item_id
), y2025 AS (
    SELECT oci.menu_item_id, SUM(oci.quantity) AS sold
    FROM order_coffee_items oci
    JOIN orders o ON o.order_id = oci.order_id
    WHERE o.order_ts >= '2025-01-01' AND o.order_ts < '2026-01-01'
    GROUP BY oci.menu_item_id
)
SELECT m.item_name, a.sold AS sold_2023, b.sold AS sold_2025
FROM y2023 a
FULL OUTER JOIN y2025 b ON b.menu_item_id = a.menu_item_id
JOIN menu_items m ON m.menu_item_id = COALESCE(a.menu_item_id, b.menu_item_id)
ORDER BY m.item_name;`,
    insight: 'Affogato was retired in 2024 and Lavender Honey Latte launched that year, so each has a NULL. Also notice Matcha Latte nearly doubled: it\'s getting more popular at the same time it\'s losing money.',
  },
  'suppliers-and-items': {
    sql: `SELECT s.supplier_name, i.item_name
FROM suppliers s
FULL OUTER JOIN inventory_items i ON i.supplier_id = s.supplier_id
ORDER BY s.supplier_name, i.item_name;`,
    insight: 'Pageturner (books only) and Mountain Spring (no longer used) appear with no items, and Local Honey appears with no supplier. A FULL OUTER JOIN is a quick way to audit two lists against each other.',
  },

  'bundle-combos': {
    sql: `SELECT m.item_name, b.title,
       ROUND((m.current_price + b.list_price) * 0.90, 2) AS bundle_price
FROM menu_items m
CROSS JOIN books b
WHERE m.category = 'Espresso Drinks'
  AND m.retired_date IS NULL
  AND b.format = 'Paperback'
  AND b.list_price < 15
ORDER BY bundle_price;`,
    insight: '11 drinks × 7 books = 77 combos. CROSS JOINs grow fast: orders × orders would be about 1.3 billion rows, which is why the lab stops queries after 8 seconds.',
  },
  'store-never-sold': {
    sql: `SELECT s.store_name, m.item_name
FROM stores s
CROSS JOIN menu_items m
LEFT JOIN (
    SELECT DISTINCT o.store_id, oci.menu_item_id
    FROM order_coffee_items oci
    JOIN orders o ON o.order_id = oci.order_id
) sold ON sold.store_id = s.store_id AND sold.menu_item_id = m.menu_item_id
WHERE m.retired_date IS NULL
  AND sold.menu_item_id IS NULL;`,
    insight: 'The Campus store has no nitro tap, so it has never sold Nitro Cold Brew. Building every possible pair and keeping the missing ones is how analysts find gaps that never show up in sales data.',
  },
  'zero-fill-months': {
    sql: `WITH months AS (
    SELECT generate_series('2025-01-01'::date, '2025-12-01'::date, interval '1 month')::date AS month
), categories AS (
    SELECT DISTINCT category FROM menu_items
), sales AS (
    SELECT DATE_TRUNC('month', o.order_ts)::date AS month, m.category,
           SUM(oci.unit_price * oci.quantity) AS revenue
    FROM order_coffee_items oci
    JOIN orders     o ON o.order_id = oci.order_id
    JOIN menu_items m ON m.menu_item_id = oci.menu_item_id
    WHERE o.order_ts >= '2025-01-01' AND o.order_ts < '2026-01-01'
    GROUP BY 1, 2
)
SELECT mo.month, c.category, COALESCE(s.revenue, 0) AS revenue
FROM months mo
CROSS JOIN categories c
LEFT JOIN sales s ON s.month = mo.month AND s.category = c.category
ORDER BY c.category, mo.month;`,
    insight: 'Seasonal drinks only sell September to December, so 8 months are zero. Without those zero rows, a chart would skip months or draw a misleading line straight across them.',
  },

  managers: {
    sql: `SELECT e.first_name || ' ' || e.last_name     AS employee,
       mgr.first_name || ' ' || mgr.last_name AS manager
FROM employees e
LEFT JOIN employees mgr ON mgr.employee_id = e.manager_id
ORDER BY e.employee_id;`,
    insight: 'Self joins model hierarchies: org charts, category trees, and referral chains all work this way.',
  },
  'biggest-team': {
    sql: `SELECT mgr.first_name || ' ' || mgr.last_name AS manager, COUNT(*) AS direct_reports
FROM employees e
JOIN employees mgr ON mgr.employee_id = e.manager_id
GROUP BY mgr.first_name, mgr.last_name
ORDER BY direct_reports DESC;`,
    insight: 'Jordan Lee and Tyler Grant each have three direct reports, more than either store manager. Org data like this feeds staffing and promotion planning.',
  },
  'coworker-pairs': {
    sql: `SELECT e1.first_name || ' ' || e1.last_name AS employee_1,
       e2.first_name || ' ' || e2.last_name AS employee_2,
       s.store_name
FROM employees e1
JOIN employees e2 ON e2.store_id = e1.store_id
                 AND e1.employee_id < e2.employee_id
JOIN stores s ON s.store_id = e1.store_id
ORDER BY s.store_name, e1.employee_id, e2.employee_id;`,
    insight: 'Each store produced 15 pairs from 6 people (6 × 5 ÷ 2). The e1.employee_id < e2.employee_id trick is the standard way to list each pair only once.',
  },

  'profit-by-drink': {
    sql: `SELECT m.item_name,
       SUM(oci.unit_price * oci.quantity)                   AS revenue,
       SUM(oci.unit_cost  * oci.quantity)                   AS cost,
       SUM((oci.unit_price - oci.unit_cost) * oci.quantity) AS profit
FROM order_coffee_items oci
JOIN menu_items m ON m.menu_item_id = oci.menu_item_id
GROUP BY m.item_name
ORDER BY profit DESC;`,
    orderBy: [[3, 'desc']],
    orderHint: 'most profitable first',
    insight: 'Latte makes the most profit by a wide margin. Matcha Latte has the 7th-highest revenue but almost the lowest profit: its cost ate nearly 90% of what it brought in.',
  },
  'losing-2025': {
    sql: `SELECT m.item_name,
       SUM((oci.unit_price - oci.unit_cost) * oci.quantity) AS profit_2025
FROM order_coffee_items oci
JOIN orders     o ON o.order_id = oci.order_id
JOIN menu_items m ON m.menu_item_id = oci.menu_item_id
WHERE o.order_ts >= '2025-01-01' AND o.order_ts < '2026-01-01'
GROUP BY m.item_name
HAVING SUM((oci.unit_price - oci.unit_cost) * oci.quantity) < 0;`,
    insight: 'Matcha Latte was the only drink that lost money in 2025. A drink can be popular and still lose money on every cup.',
  },
  'matcha-by-year': {
    sql: `SELECT EXTRACT(YEAR FROM o.order_ts) AS year,
       SUM(oci.quantity)                                    AS drinks_sold,
       SUM(oci.unit_price * oci.quantity)                   AS revenue,
       SUM((oci.unit_price - oci.unit_cost) * oci.quantity) AS profit
FROM order_coffee_items oci
JOIN orders     o ON o.order_id = oci.order_id
JOIN menu_items m ON m.menu_item_id = oci.menu_item_id
WHERE m.item_name = 'Matcha Latte'
GROUP BY 1
ORDER BY 1;`,
    insight: 'Sales almost doubled from 2023 to 2025, but profit went from about +$1,360 to −$600. Selling more of a drink that loses money just loses more money.',
  },
  'matcha-cost-history': {
    sql: `SELECT h.effective_date AS quarter_start,
       ROUND(SUM(r.quantity * h.unit_cost), 2) AS cost_per_drink
FROM menu_items m
JOIN recipe_ingredients      r ON r.menu_item_id = m.menu_item_id
JOIN ingredient_cost_history h ON h.inventory_item_id = r.inventory_item_id
WHERE m.item_name = 'Matcha Latte'
GROUP BY h.effective_date
ORDER BY h.effective_date;`,
    insight: 'One Matcha Latte went from $2.28 to $5.97 to make, almost all of it from the ceremonial matcha powder, while the price stayed at $4.95 until August 2026. Tracking cost history is how you catch this before it hurts.',
  },
  'promo-profit': {
    sql: `WITH promo_lines AS (
    SELECT promotion_id, quantity, unit_price, unit_cost
    FROM order_coffee_items WHERE promotion_id IS NOT NULL
    UNION ALL
    SELECT promotion_id, quantity, unit_price, unit_cost
    FROM order_book_items WHERE promotion_id IS NOT NULL
)
SELECT p.promo_name, p.start_date,
       SUM(pl.quantity) AS units,
       SUM((pl.unit_price - pl.unit_cost) * pl.quantity) AS profit
FROM promotions p
JOIN promo_lines pl ON pl.promotion_id = p.promotion_id
GROUP BY p.promotion_id, p.promo_name, p.start_date
ORDER BY profit;`,
    insight: 'Two promotions sold below cost: the Matcha Spring Special (25% off a drink that was already losing money) and a 60%-off Crawdads clearance. Cold Brew Summer, meanwhile, was the most profitable promotion both times it ran.',
  },
  'genre-ranking': {
    sql: `SELECT g.genre_name,
       SUM(obi.quantity)                                    AS copies,
       SUM(obi.unit_price * obi.quantity)                   AS revenue,
       SUM((obi.unit_price - obi.unit_cost) * obi.quantity) AS profit
FROM order_book_items obi
JOIN books  b ON b.book_id  = obi.book_id
JOIN genres g ON g.genre_id = b.genre_id
GROUP BY g.genre_name
ORDER BY profit DESC;`,
    orderBy: [[3, 'desc']],
    orderHint: 'highest profit first',
    insight: 'Fantasy wins on every measure. But Technology sold the fewest copies of any genre except Food & Drink and still beat Kids & Young Adult on profit, because those books cost $50–60. The metric you rank by changes the story.',
  },
  'genre-trend': {
    sql: `WITH by_year AS (
    SELECT g.genre_name,
           SUM(obi.quantity) FILTER (WHERE EXTRACT(YEAR FROM o.order_ts) = 2023) AS copies_2023,
           SUM(obi.quantity) FILTER (WHERE EXTRACT(YEAR FROM o.order_ts) = 2025) AS copies_2025
    FROM order_book_items obi
    JOIN orders o ON o.order_id = obi.order_id
    JOIN books  b ON b.book_id  = obi.book_id
    JOIN genres g ON g.genre_id = b.genre_id
    GROUP BY g.genre_name
)
SELECT genre_name, copies_2023, copies_2025,
       ROUND(100.0 * (copies_2025 - copies_2023) / copies_2023, 1) AS pct_change
FROM by_year
ORDER BY pct_change DESC;`,
    insight: 'Fantasy grew about 51% from 2023 to 2025, and Romance about 37%. Technology and Horror are shrinking. This is the evidence a buyer would use to shift shelf space.',
  },
  'store-showdown': {
    sql: `WITH coffee AS (
    SELECT o.store_id,
           SUM(oci.unit_price * oci.quantity)                   AS revenue,
           SUM((oci.unit_price - oci.unit_cost) * oci.quantity) AS profit
    FROM order_coffee_items oci
    JOIN orders o ON o.order_id = oci.order_id
    WHERE o.order_ts >= '2025-01-01' AND o.order_ts < '2026-01-01'
    GROUP BY o.store_id
), book AS (
    SELECT o.store_id,
           SUM(obi.unit_price * obi.quantity)                   AS revenue,
           SUM((obi.unit_price - obi.unit_cost) * obi.quantity) AS profit
    FROM order_book_items obi
    JOIN orders o ON o.order_id = obi.order_id
    WHERE o.order_ts >= '2025-01-01' AND o.order_ts < '2026-01-01'
    GROUP BY o.store_id
)
SELECT s.store_name,
       c.profit + b.profit AS total_profit,
       ROUND(100 * b.revenue / (c.revenue + b.revenue), 1) AS book_pct_of_revenue
FROM stores s
JOIN coffee c ON c.store_id = s.store_id
JOIN book   b ON b.store_id = s.store_id
ORDER BY total_profit DESC;`,
    insight: 'Downtown made almost twice the profit of Campus in 2025, and books are a bigger share of its revenue. Campus traffic drops in summer and over winter break.',
  },
  'loyalty-value': {
    sql: `WITH order_totals AS (
    SELECT order_id, SUM(unit_price * quantity) AS order_total
    FROM (
        SELECT order_id, unit_price, quantity FROM order_coffee_items
        UNION ALL
        SELECT order_id, unit_price, quantity FROM order_book_items
    ) lines
    GROUP BY order_id
)
SELECT c.loyalty_tier AS tier,
       ROUND(AVG(t.order_total), 2) AS avg_order_value,
       ROUND(COUNT(*)::numeric / COUNT(DISTINCT o.customer_id), 1) AS orders_per_customer
FROM orders o
JOIN order_totals t ON t.order_id = o.order_id
JOIN customers c    ON c.customer_id = o.customer_id
GROUP BY c.loyalty_tier
ORDER BY orders_per_customer DESC;`,
    insight: 'Average order size is about $9.40 for every tier. Gold members are valuable because they come back about 5 times as often as Bronze members, not because they spend more per visit.',
  },
  'top-customers': {
    sql: `WITH spend AS (
    SELECT o.customer_id, SUM(l.unit_price * l.quantity) AS total_spent
    FROM orders o
    JOIN (
        SELECT order_id, unit_price, quantity FROM order_coffee_items
        UNION ALL
        SELECT order_id, unit_price, quantity FROM order_book_items
    ) l ON l.order_id = o.order_id
    WHERE o.customer_id IS NOT NULL
    GROUP BY o.customer_id
)
SELECT c.first_name, c.last_name, c.loyalty_tier, st.store_name AS home_store, sp.total_spent
FROM spend sp
JOIN customers c ON c.customer_id = sp.customer_id
JOIN stores   st ON st.store_id   = c.home_store_id
ORDER BY sp.total_spent DESC
LIMIT 10;`,
    orderBy: [[4, 'desc']],
    orderHint: 'biggest spender first',
    insight: 'Every top-10 customer is a Gold member, which matches the last question: frequent visits drive lifetime value.',
  },
  'rush-hour': {
    sql: `WITH counts AS (
    SELECT s.store_name, EXTRACT(HOUR FROM o.order_ts) AS hour, COUNT(*) AS orders
    FROM orders o
    JOIN stores s ON s.store_id = o.store_id
    GROUP BY s.store_name, EXTRACT(HOUR FROM o.order_ts)
)
SELECT store_name, hour, orders
FROM counts c
WHERE orders = (SELECT MAX(orders) FROM counts c2 WHERE c2.store_name = c.store_name);`,
    insight: '8 a.m. is the peak at both stores. Hourly patterns like this drive staffing schedules and when to prep batch cold brew.',
  },
  'restock-bill': {
    sql: `SELECT i.item_name,
       COALESCE(s.supplier_name, 'No supplier') AS supplier,
       2 * i.reorder_level - i.quantity_on_hand AS qty_to_order,
       ROUND((2 * i.reorder_level - i.quantity_on_hand) * i.current_unit_cost, 2) AS estimated_cost
FROM inventory_items i
LEFT JOIN suppliers s ON s.supplier_id = i.supplier_id
WHERE i.quantity_on_hand < i.reorder_level
ORDER BY estimated_cost DESC;`,
    insight: 'Matcha powder is the biggest restock cost by far, for the drink that\'s been losing money. And Vanilla Ice Cream is only used by the retired Affogato, so it shouldn\'t be reordered at all.',
  },
  'monthly-pl-2025': {
    sql: `WITH coffee AS (
    SELECT DATE_TRUNC('month', o.order_ts)::date AS month,
           SUM((oci.unit_price - oci.unit_cost) * oci.quantity) AS coffee_profit
    FROM order_coffee_items oci
    JOIN orders o ON o.order_id = oci.order_id
    WHERE o.order_ts >= '2025-01-01' AND o.order_ts < '2026-01-01'
    GROUP BY 1
), book AS (
    SELECT DATE_TRUNC('month', o.order_ts)::date AS month,
           SUM((obi.unit_price - obi.unit_cost) * obi.quantity) AS book_profit
    FROM order_book_items obi
    JOIN orders o ON o.order_id = obi.order_id
    WHERE o.order_ts >= '2025-01-01' AND o.order_ts < '2026-01-01'
    GROUP BY 1
)
SELECT c.month, c.coffee_profit, b.book_profit,
       c.coffee_profit + b.book_profit AS total_profit
FROM coffee c
JOIN book b ON b.month = c.month
ORDER BY c.month;`,
    insight: 'December is the best month, mostly from holiday book sales. June is the low point, when Campus traffic drops for summer. A monthly P&L like this is a staple of small-business reporting.',
  },

  'genre-bestseller': {
    sql: `WITH ranked AS (
    SELECT g.genre_name, b.title, SUM(obi.quantity) AS copies,
           RANK() OVER (PARTITION BY g.genre_name ORDER BY SUM(obi.quantity) DESC) AS rnk
    FROM order_book_items obi
    JOIN books  b ON b.book_id  = obi.book_id
    JOIN genres g ON g.genre_id = b.genre_id
    GROUP BY g.genre_name, b.title
)
SELECT genre_name, title, copies
FROM ranked
WHERE rnk = 1
ORDER BY copies DESC;`,
    insight: 'Technology has a tie, which is why RANK() returned two rows for it. ROW_NUMBER() would have picked one at random. Choosing between them is a real decision in reporting.',
  },
  'mom-change': {
    sql: `WITH monthly AS (
    SELECT DATE_TRUNC('month', o.order_ts)::date AS month,
           SUM(oci.unit_price * oci.quantity) AS revenue
    FROM order_coffee_items oci
    JOIN orders o ON o.order_id = oci.order_id
    WHERE o.order_ts >= '2025-01-01' AND o.order_ts < '2026-01-01'
    GROUP BY 1
)
SELECT month, revenue,
       revenue - LAG(revenue) OVER (ORDER BY month) AS change_vs_prior_month
FROM monthly
ORDER BY month;`,
    insight: 'June is the big drop (−$1,186) and July and August recover. Month-over-month change is how seasonality shows up in a report.',
  },
  'ytd-books': {
    sql: `WITH monthly AS (
    SELECT DATE_TRUNC('month', o.order_ts)::date AS month,
           SUM(obi.unit_price * obi.quantity) AS revenue
    FROM order_book_items obi
    JOIN orders o ON o.order_id = obi.order_id
    WHERE o.order_ts >= '2025-01-01' AND o.order_ts < '2026-01-01'
    GROUP BY 1
)
SELECT month, revenue, SUM(revenue) OVER (ORDER BY month) AS ytd_revenue
FROM monthly
ORDER BY month;`,
    insight: 'Book revenue was steady most of the year, then December alone added about $5,100. Running totals make it easy to see whether you\'re on pace for a yearly goal.',
  },
  'rank-in-category': {
    sql: `WITH profit AS (
    SELECT m.category, m.item_name,
           SUM((oci.unit_price - oci.unit_cost) * oci.quantity) AS profit
    FROM order_coffee_items oci
    JOIN menu_items m ON m.menu_item_id = oci.menu_item_id
    GROUP BY m.category, m.item_name
)
SELECT category, item_name, profit,
       RANK() OVER (PARTITION BY category ORDER BY profit DESC) AS category_rank
FROM profit
ORDER BY category, category_rank;`,
    insight: 'Within Tea, Matcha Latte ranks last despite having the highest tea revenue. Ranking within a group answers \"best in its category\" questions that a single overall ranking can\'t.',
  },
};
