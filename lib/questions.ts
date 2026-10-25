// Public question content: safe to send to the browser.
// Reference solutions and insights live in lib/solutions.ts (server only).

export type Part = { id: string; title: string; intro: string };
export type Question = {
  id: string;
  part: string;
  title: string;
  prompt: string;
  hints: [string, string, string];
};

export const PARTS: Part[] = [
  { id: 'warmup', title: 'Warm-up', intro: 'One table at a time. Get to know the data before joining anything.' },
  { id: 'inner', title: 'INNER JOIN', intro: 'Combine tables and keep only the rows that match on both sides.' },
  { id: 'left', title: 'LEFT JOIN', intro: 'Keep every row from the left table, even when nothing matches on the right. This is how you find what’s missing.' },
  { id: 'full', title: 'FULL OUTER JOIN', intro: 'Keep the unmatched rows from both sides.' },
  { id: 'cross', title: 'CROSS JOIN', intro: 'Pair every row with every row. Useful for combinations and for complete grids you fill in.' },
  { id: 'self', title: 'Self join', intro: 'Join a table to itself using two different aliases.' },
  { id: 'business', title: 'Business questions', intro: 'The owner wants answers. Most of these need several tables, GROUP BY, and a profit formula.' },
  { id: 'window', title: 'Window functions', intro: 'Rankings, running totals, and comparisons with the previous row.' },
];

export const QUESTIONS: Question[] = [
  // ---------------------------------------------------------------- warm-up
  {
    id: 'todays-menu', part: 'warmup', title: 'Today’s menu',
    prompt: 'List every drink that’s still on the menu (not retired). Show item_name and current_price, most expensive first.',
    hints: [
      'Everything you need is in the menu_items table.',
      'Retired drinks have a date in retired_date. Drinks still on the menu have NULL there. Use IS NULL, because = NULL never matches anything.',
      'SELECT item_name, current_price FROM menu_items WHERE … ORDER BY current_price DESC;',
    ],
  },
  {
    id: 'reorder', part: 'warmup', title: 'Time to reorder',
    prompt: 'Which inventory items are below their reorder level? Show item_name, quantity_on_hand, reorder_level, and units_short (how far below the reorder level each item is).',
    hints: [
      'Use the inventory_items table.',
      'You can compare two columns of the same row in WHERE: quantity_on_hand < reorder_level.',
      'You can do math in SELECT too: reorder_level - quantity_on_hand AS units_short',
    ],
  },
  {
    id: 'out-of-stock', part: 'warmup', title: 'Out-of-stock books',
    prompt: 'Which books have zero copies on hand? Show the title.',
    hints: [
      'Use the books table.',
      'The column you’re filtering on is quantity_on_hand.',
      'SELECT title FROM books WHERE quantity_on_hand = 0;',
    ],
  },
  {
    id: 'payment-trend', part: 'warmup', title: 'Is cash fading?',
    prompt: 'Count orders by year and payment method. Show year, payment_method, and orders.',
    hints: [
      'Everything is in the orders table.',
      'EXTRACT(YEAR FROM order_ts) pulls the year out of a timestamp. Group by both the year and payment_method.',
      'SELECT EXTRACT(YEAR FROM order_ts) AS year, payment_method, COUNT(*) AS orders FROM orders GROUP BY 1, 2 ORDER BY 1, 2;',
    ],
  },

  // ---------------------------------------------------------------- inner join
  {
    id: 'book-catalog', part: 'inner', title: 'The book catalog',
    prompt: 'List every book with its author and genre. Show genre_name, title, and author_name.',
    hints: [
      'books only stores author_id and genre_id. The names live in the authors and genres tables.',
      'You need two joins: books to authors, and books to genres.',
      'FROM books b JOIN authors a ON a.author_id = b.author_id JOIN genres g ON g.genre_id = b.genre_id',
    ],
  },
  {
    id: 'macchiato-ingredients', part: 'inner', title: 'What’s in a Caramel Macchiato?',
    prompt: 'Show every ingredient in a Caramel Macchiato: the ingredient’s item_name, the quantity used, and its unit.',
    hints: [
      'The drink is in menu_items, the amounts are in recipe_ingredients, and the ingredient names and units are in inventory_items.',
      'Chain the joins: menu_items to recipe_ingredients on menu_item_id, then recipe_ingredients to inventory_items on inventory_item_id.',
      'SELECT i.item_name, r.quantity, i.unit FROM menu_items m JOIN recipe_ingredients r ON … JOIN inventory_items i ON … WHERE m.item_name = \'Caramel Macchiato\';',
    ],
  },
  {
    id: 'macchiato-steps', part: 'inner', title: 'How to make it',
    prompt: 'List the preparation steps for a Caramel Macchiato in order. Show step_number and instruction.',
    hints: [
      'The steps are in recipe_steps, which only knows the menu_item_id.',
      'Join menu_items to recipe_steps on menu_item_id and filter by the drink’s name.',
      'End with ORDER BY s.step_number',
    ],
  },
  {
    id: 'drink-cost-today', part: 'inner', title: 'What does each drink cost to make?',
    prompt: 'Using today’s ingredient costs, what does one of each current (not retired) drink cost to make? Show item_name, cost_to_make, current_price, and profit_per_drink.',
    hints: [
      'Cost to make = the sum of (recipe quantity × ingredient cost) across all of a drink’s ingredients. Today’s cost is current_unit_cost on inventory_items.',
      'Join menu_items to recipe_ingredients to inventory_items, then GROUP BY the drink. Leave out retired drinks.',
      'SUM(r.quantity * i.current_unit_cost) AS cost_to_make, and m.current_price - SUM(…) AS profit_per_drink. Put m.current_price in the GROUP BY too.',
    ],
  },
  {
    id: 'category-revenue-2025', part: 'inner', title: 'Revenue by drink category',
    prompt: 'How much revenue did each drink category bring in during 2025, and how many drinks did it sell? Show category, drinks_sold, and revenue.',
    hints: [
      'Sales lines are in order_coffee_items, the date is on orders, and the category is on menu_items.',
      'Revenue for a sales line is unit_price × quantity.',
      'WHERE o.order_ts >= \'2025-01-01\' AND o.order_ts < \'2026-01-01\' … GROUP BY m.category',
    ],
  },
  {
    id: 'top-books', part: 'inner', title: 'Top 5 best sellers',
    prompt: 'Which 5 books have sold the most copies of all time? Show title, author_name, and copies_sold, best seller first.',
    hints: [
      'Copies sold come from order_book_items. Titles are in books and author names are in authors.',
      'SUM the quantity per book, then sort by that sum, highest first.',
      '… GROUP BY b.title, a.author_name ORDER BY copies_sold DESC LIMIT 5;',
    ],
  },
  {
    id: 'supplier-spend', part: 'inner', title: 'Who do we pay the most?',
    prompt: 'How much have we spent with each supplier across all inventory purchases? Show supplier_name and total_spent, biggest first.',
    hints: [
      'Purchases are in inventory_purchases. Supplier names are in suppliers.',
      'The spend on one purchase is quantity × unit_cost.',
      'SUM(p.quantity * p.unit_cost) AS total_spent … GROUP BY s.supplier_name ORDER BY total_spent DESC',
    ],
  },
  {
    id: 'staff-orders-2025', part: 'inner', title: 'Busiest staff member',
    prompt: 'How many orders did each employee ring up in 2025? Show first_name, last_name, store_name, and orders, for employees who took at least one order.',
    hints: [
      'orders has both employee_id and store_id. The names are in employees and stores.',
      'Join orders to employees and to stores, filter to 2025, then group by the person and store.',
      'COUNT(*) AS orders … GROUP BY e.first_name, e.last_name, s.store_name',
    ],
  },

  // ---------------------------------------------------------------- left join
  {
    id: 'unused-ingredients', part: 'left', title: 'Ingredients no drink uses',
    prompt: 'List every inventory item and how many drinks use it. Items that aren’t in any recipe must show 0, not disappear. Show item_name and used_in_drinks.',
    hints: [
      'Start FROM inventory_items so every item is kept, then LEFT JOIN recipe_ingredients.',
      'Items with no match come back with NULLs from recipe_ingredients, and COUNT(*) would count that row as 1.',
      'COUNT(r.menu_item_id) only counts real matches, so unused items get 0.',
    ],
  },
  {
    id: 'unsold-books', part: 'left', title: 'Books that never sold',
    prompt: 'Which books have never sold a single copy? Show the title.',
    hints: [
      'Start from books and LEFT JOIN order_book_items.',
      'A book with no sales comes back with NULL in every order_book_items column.',
      'WHERE obi.book_id IS NULL. This pattern is called an anti-join.',
    ],
  },
  {
    id: 'empty-genre', part: 'left', title: 'Empty shelf',
    prompt: 'Is there a genre we track but don’t carry any books for? Show the genre_name.',
    hints: [
      'Start from genres and LEFT JOIN books.',
      'A genre with no books has NULL in every books column.',
      'WHERE b.book_id IS NULL',
    ],
  },
  {
    id: 'genre-sales-2025', part: 'left', title: 'Zero is an answer',
    prompt: 'Show every genre with the number of copies sold in 2025. Genres with no 2025 sales must show 0. Show genre_name and copies.',
    hints: [
      'You need every genre, so start FROM genres and LEFT JOIN toward the sales.',
      'Careful: a 2025 date filter in WHERE removes the genres with no sales, which quietly turns your LEFT JOIN back into an INNER JOIN.',
      'Total the 2025 copies per genre_id in a CTE or subquery first, then LEFT JOIN genres to it and use COALESCE(copies, 0).',
    ],
  },
  {
    id: 'never-ordered-count', part: 'left', title: 'Signed up, never came back',
    prompt: 'How many loyalty customers have never placed an order? Return a single number.',
    hints: [
      'Start from customers and LEFT JOIN orders on customer_id.',
      'A customer with no orders has NULL in every orders column.',
      'SELECT COUNT(*) FROM customers c LEFT JOIN orders o ON … WHERE o.order_id IS NULL;',
    ],
  },
  {
    id: 'never-ordered-earliest', part: 'left', title: 'Longest-waiting members',
    prompt: 'Of the customers who have never ordered, which 5 joined earliest? Show first_name, last_name, and join_date.',
    hints: [
      'Start with the same LEFT JOIN as the previous question.',
      'Sort by join_date, oldest first, and keep 5 rows.',
      '… WHERE o.order_id IS NULL ORDER BY c.join_date LIMIT 5;',
    ],
  },
  {
    id: 'item-suppliers', part: 'left', title: 'INNER vs LEFT',
    prompt: 'List every inventory item with its supplier’s name, showing the text ‘No supplier’ where there isn’t one. Show item_name and supplier. Try it with an INNER JOIN first and count the rows. Which item disappears?',
    hints: [
      'inventory_items.supplier_id points to suppliers. One item has NULL there.',
      'An INNER JOIN drops the item with no supplier. A LEFT JOIN keeps it, with NULL for the supplier name.',
      'COALESCE(s.supplier_name, \'No supplier\') AS supplier',
    ],
  },
  {
    id: 'dead-supplier', part: 'left', title: 'A supplier we don’t use',
    prompt: 'Which supplier doesn’t supply any inventory item and doesn’t supply any book? Show supplier_name.',
    hints: [
      'Suppliers connect to both inventory_items and books through supplier_id.',
      'LEFT JOIN both tables from suppliers.',
      'WHERE i.inventory_item_id IS NULL AND b.book_id IS NULL',
    ],
  },
  {
    id: 'tier-orders', part: 'left', title: 'Members vs walk-ins',
    prompt: 'Count orders by loyalty tier. Orders with no customer are walk-ins and should be labeled ‘Walk-in’. Show tier and orders.',
    hints: [
      'orders.customer_id is NULL for walk-ins.',
      'LEFT JOIN customers so walk-in orders are kept, then group by tier.',
      'COALESCE(c.loyalty_tier, \'Walk-in\') AS tier … GROUP BY 1',
    ],
  },

  // ---------------------------------------------------------------- full outer join
  {
    id: 'drinks-2023-vs-2025', part: 'full', title: '2023 vs 2025',
    prompt: 'Show drinks sold in 2023 next to drinks sold in 2025, one row per drink. Include drinks that only sold in one of those years, with NULL for the other year. Show item_name, sold_2023, and sold_2025.',
    hints: [
      'Total each year separately first, one row per menu_item_id. Two CTEs work well.',
      'FULL OUTER JOIN the two totals on menu_item_id so drinks that only sold in one year still appear.',
      'To get the name, join menu_items ON m.menu_item_id = COALESCE(a.menu_item_id, b.menu_item_id).',
    ],
  },
  {
    id: 'suppliers-and-items', part: 'full', title: 'Audit two lists at once',
    prompt: 'Show every supplier and every inventory item side by side. Suppliers with no items and items with no supplier should both appear. Show supplier_name and item_name.',
    hints: [
      'A LEFT JOIN keeps unmatched rows from one side. Here you need both sides.',
      'FROM suppliers s FULL OUTER JOIN inventory_items i ON i.supplier_id = s.supplier_id',
      'Unmatched rows show NULL on the other side. You should get more rows than there are inventory items.',
    ],
  },

  // ---------------------------------------------------------------- cross join
  {
    id: 'bundle-combos', part: 'cross', title: 'Bundle deal brainstorm',
    prompt: 'Marketing wants a coffee + book bundle: any current Espresso Drinks item paired with any paperback listed under $15, at 10% off the two prices combined. Show item_name, title, and bundle_price for every combination.',
    hints: [
      'No column links a drink to a book, so there’s nothing to join ON.',
      'CROSS JOIN pairs every drink with every book. WHERE then filters both sides.',
      'WHERE m.category = \'Espresso Drinks\' AND m.retired_date IS NULL AND b.format = \'Paperback\' AND b.list_price < 15, and bundle_price = (m.current_price + b.list_price) * 0.90',
    ],
  },
  {
    id: 'store-never-sold', part: 'cross', title: 'What each store has never sold',
    prompt: 'For every store and every current menu item, find the pairs where that store has never sold that drink. Show store_name and item_name.',
    hints: [
      'Start with every possible store and drink pair: stores CROSS JOIN menu_items.',
      'Then LEFT JOIN the pairs that actually sold: a DISTINCT list of store_id and menu_item_id from orders joined to order_coffee_items.',
      'Keep the pairs where the sales side is NULL, and only drinks that aren’t retired.',
    ],
  },
  {
    id: 'zero-fill-months', part: 'cross', title: 'Fill in the zeros',
    prompt: 'Build a 2025 report with one row for every month and every drink category (12 × 5 = 60 rows) showing revenue. Months where a category sold nothing must show 0. Show month, category, and revenue.',
    hints: [
      'generate_series(\'2025-01-01\'::date, \'2025-12-01\'::date, interval \'1 month\') gives you the 12 months.',
      'CROSS JOIN the months with SELECT DISTINCT category FROM menu_items to build the grid, then LEFT JOIN the real monthly revenue onto it.',
      'Total sales by DATE_TRUNC(\'month\', o.order_ts) and category in a CTE first, then use COALESCE(revenue, 0).',
    ],
  },

  // ---------------------------------------------------------------- self join
  {
    id: 'managers', part: 'self', title: 'Who’s the boss?',
    prompt: 'List every employee next to their manager. Show employee (first and last name in one column, separated by a space) and manager (the manager’s full name). The owner has no manager but should still appear.',
    hints: [
      'manager_id points to another row in the same employees table.',
      'Join employees to itself with two aliases: employees e LEFT JOIN employees mgr ON mgr.employee_id = e.manager_id',
      'e.first_name || \' \' || e.last_name AS employee',
    ],
  },
  {
    id: 'biggest-team', part: 'self', title: 'Biggest team',
    prompt: 'How many direct reports does each manager have? Count everyone who has ever reported to them. Show manager (full name) and direct_reports.',
    hints: [
      'Same self join as the last question, but an INNER JOIN this time: only people who have a manager count.',
      'Group by the manager’s name and count the employees.',
      'COUNT(*) AS direct_reports … GROUP BY mgr.first_name, mgr.last_name',
    ],
  },
  {
    id: 'coworker-pairs', part: 'self', title: 'Coworker pairs',
    prompt: 'List every pair of employees on record who work at the same store, with each pair only once. Show employee_1 and employee_2 (full names, with the lower employee_id first) and store_name.',
    hints: [
      'Join employees to itself on store_id.',
      'e1.employee_id < e2.employee_id keeps each pair once and stops people from being paired with themselves.',
      'Join stores to get store_name. The owner has no store_id, so they drop out on their own.',
    ],
  },

  // ---------------------------------------------------------------- business
  {
    id: 'profit-by-drink', part: 'business', title: 'Our money-maker',
    prompt: 'Which drink has made the most profit of all time, and which the least? Show item_name, revenue, cost, and profit for every drink, most profitable first.',
    hints: [
      'Each sales line in order_coffee_items stores unit_price (what the customer paid) and unit_cost (what the drink cost us).',
      'Revenue = unit_price × quantity. Cost = unit_cost × quantity. Profit = revenue − cost.',
      'SUM((oci.unit_price - oci.unit_cost) * oci.quantity) AS profit … GROUP BY m.item_name ORDER BY profit DESC',
    ],
  },
  {
    id: 'losing-2025', part: 'business', title: 'Losing money',
    prompt: 'Which drinks lost money in 2025? Show item_name and profit_2025 for every drink whose 2025 profit was below zero.',
    hints: [
      'Profit for a sales line is (unit_price − unit_cost) × quantity. The date is on orders.',
      'Filter to 2025 in WHERE, then group by drink.',
      'Filter on the total with HAVING SUM(…) < 0. WHERE can’t see aggregates.',
    ],
  },
  {
    id: 'matcha-by-year', part: 'business', title: 'The matcha problem',
    prompt: 'Track the Matcha Latte year by year. Show year, drinks_sold, revenue, and profit.',
    hints: [
      'Join order_coffee_items to orders (for the date) and menu_items (for the name).',
      'Filter WHERE m.item_name = \'Matcha Latte\' and group by EXTRACT(YEAR FROM o.order_ts).',
      'SUM(oci.quantity) AS drinks_sold, SUM(oci.unit_price * oci.quantity) AS revenue, and the profit formula from before.',
    ],
  },
  {
    id: 'matcha-cost-history', part: 'business', title: 'Why is matcha underwater?',
    prompt: 'Using recipe_ingredients and ingredient_cost_history, show what one Matcha Latte cost to make in each quarter. Show quarter_start (the effective_date) and cost_per_drink. Bonus: add a column for just the matcha powder’s share.',
    hints: [
      'ingredient_cost_history has one row per ingredient per quarter. recipe_ingredients says how much of each ingredient one drink uses.',
      'Join menu_items to recipe_ingredients, then to ingredient_cost_history on inventory_item_id, and group by effective_date.',
      'SUM(r.quantity * h.unit_cost) AS cost_per_drink … WHERE m.item_name = \'Matcha Latte\' GROUP BY h.effective_date',
    ],
  },
  {
    id: 'promo-profit', part: 'business', title: 'Promotions that backfired',
    prompt: 'For each promotion that has run, show promo_name, start_date, units sold at the discount, and the profit on those discounted sales.',
    hints: [
      'Discounted sales are in two tables, order_coffee_items and order_book_items, and both have promotion_id.',
      'Stack them with UNION ALL (same columns in each SELECT), then join the result to promotions.',
      'Romance Month ran three times, so group by promotion_id (or start_date) as well as promo_name.',
    ],
  },
  {
    id: 'genre-ranking', part: 'business', title: 'What kind of books sell best?',
    prompt: 'Rank genres by profit, highest first. Show genre_name, copies, revenue, and profit. Does the order change if you rank by copies instead?',
    hints: [
      'Book sales are in order_book_items. Join books for the genre_id and genres for the name.',
      'Copies = SUM(quantity). Revenue and profit work the same as for drinks.',
      '… GROUP BY g.genre_name ORDER BY profit DESC',
    ],
  },
  {
    id: 'genre-trend', part: 'business', title: 'Trending genres',
    prompt: 'Compare copies sold per genre in 2023 and 2025 as two columns, plus the percent change. Show genre_name, copies_2023, copies_2025, and pct_change.',
    hints: [
      'You need two years as two columns from the same rows. That’s a pivot.',
      'SUM(obi.quantity) FILTER (WHERE EXTRACT(YEAR FROM o.order_ts) = 2023) gives one year’s total. CASE WHEN inside SUM works too.',
      'pct_change = 100.0 * (copies_2025 - copies_2023) / copies_2023. Multiply by 100.0, not 100, to avoid integer division.',
    ],
  },
  {
    id: 'store-showdown', part: 'business', title: 'Store showdown',
    prompt: 'Which store made more total profit (drinks plus books) in 2025, and what percent of each store’s 2025 revenue came from books? Show store_name, total_profit, and book_pct_of_revenue.',
    hints: [
      'Joining orders to both order_coffee_items and order_book_items at once multiplies rows and inflates your sums.',
      'Total coffee and books per store in two separate CTEs, then join both to stores.',
      'book_pct_of_revenue = 100 * book revenue / (coffee revenue + book revenue)',
    ],
  },
  {
    id: 'loyalty-value', part: 'business', title: 'Are Gold members worth it?',
    prompt: 'For each loyalty tier (members only, no walk-ins), show the average order value and the average number of orders per customer. Do Gold members spend more per visit, or just visit more often? Show tier, avg_order_value, and orders_per_customer.',
    hints: [
      'An order’s value is all its drinks plus all its books. Total each order first: UNION ALL the two line tables and GROUP BY order_id.',
      'Join those order totals to orders and customers, then group by loyalty_tier.',
      'AVG(order_total) AS avg_order_value, and COUNT(*)::numeric / COUNT(DISTINCT o.customer_id) AS orders_per_customer',
    ],
  },
  {
    id: 'top-customers', part: 'business', title: 'Top 10 customers',
    prompt: 'Who are our 10 biggest spenders of all time? Show first_name, last_name, loyalty_tier, home_store (the store’s name), and total_spent, biggest first.',
    hints: [
      'Spending comes from both line tables. UNION ALL them, join to orders, and total per customer_id.',
      'Then join customers for the name and tier, and stores on home_store_id for the store name.',
      '… ORDER BY total_spent DESC LIMIT 10;',
    ],
  },
  {
    id: 'rush-hour', part: 'business', title: 'Rush hour',
    prompt: 'What’s the busiest hour of the day at each store? Return one row per store: store_name, hour, and orders.',
    hints: [
      'EXTRACT(HOUR FROM order_ts) gives the hour of an order.',
      'First count orders per store and hour. Then keep only the top hour for each store.',
      'Put the counts in a CTE, then keep rows where orders = (SELECT MAX(orders) FROM counts c2 WHERE c2.store_name = c.store_name).',
    ],
  },
  {
    id: 'restock-bill', part: 'business', title: 'The restock bill',
    prompt: 'For every inventory item below its reorder level, what would it cost to bring it up to twice its reorder level at today’s cost? Show item_name, supplier (‘No supplier’ if none), qty_to_order, and estimated_cost.',
    hints: [
      'qty_to_order = 2 × reorder_level − quantity_on_hand.',
      'estimated_cost = qty_to_order × current_unit_cost. LEFT JOIN suppliers so an item without one isn’t lost.',
      'WHERE i.quantity_on_hand < i.reorder_level',
    ],
  },
  {
    id: 'monthly-pl-2025', part: 'business', title: '2025 profit by month',
    prompt: 'Build a simple 2025 profit report by month. Show month, coffee_profit, book_profit, and total_profit.',
    hints: [
      'Coffee and book profit come from different tables. Joining both to orders at the same time multiplies rows.',
      'Total each one by month in its own CTE, then join the two CTEs on month.',
      'DATE_TRUNC(\'month\', o.order_ts) AS month, and total_profit = coffee_profit + book_profit.',
    ],
  },

  // ---------------------------------------------------------------- window functions
  {
    id: 'genre-bestseller', part: 'window', title: 'Best seller in every genre',
    prompt: 'For each genre, show only its best-selling book by copies sold. If two books tie, show both. Show genre_name, title, and copies.',
    hints: [
      'Total copies per genre and title first.',
      'RANK() OVER (PARTITION BY genre_name ORDER BY copies DESC) numbers the books within each genre.',
      'You can’t filter on a window function in WHERE. Put it in a CTE, then WHERE rnk = 1.',
    ],
  },
  {
    id: 'mom-change', part: 'window', title: 'Month over month',
    prompt: 'For 2025, show coffee revenue per month and the change from the previous month. Show month, revenue, and change_vs_prior_month. January has no previous month, so leave it NULL.',
    hints: [
      'Total coffee revenue by DATE_TRUNC(\'month\', o.order_ts) for 2025 in a CTE.',
      'LAG(revenue) OVER (ORDER BY month) gives the previous row’s revenue.',
      'revenue - LAG(revenue) OVER (ORDER BY month) AS change_vs_prior_month',
    ],
  },
  {
    id: 'ytd-books', part: 'window', title: 'Running total',
    prompt: 'Show 2025 book revenue by month with a running year-to-date total. Show month, revenue, and ytd_revenue.',
    hints: [
      'Total book revenue by month for 2025 in a CTE.',
      'A SUM with OVER adds up the rows so far.',
      'SUM(revenue) OVER (ORDER BY month) AS ytd_revenue',
    ],
  },
  {
    id: 'rank-in-category', part: 'window', title: 'Rank within category',
    prompt: 'Rank every drink by all-time profit within its category, where 1 is the most profitable in that category. Show category, item_name, profit, and category_rank.',
    hints: [
      'Total profit per drink first, keeping its category.',
      'PARTITION BY restarts the ranking for each category.',
      'RANK() OVER (PARTITION BY category ORDER BY profit DESC) AS category_rank',
    ],
  },
];

export const QUESTION_IDS = new Set(QUESTIONS.map((q) => q.id));
