**Note: See MVP_shipShape.pdf or MVP_shipShape.pptx for the complete audit report.**

# Phase 1: The Audit

This provides a brief overview of the 7 categories we measured during our system diagnostic. It explains what each category is, how we tested it, what a few baseline numbers show, why they are bad (weak points), how much they impact the project, and how we plan to fix them.

## 1. Type Safety
- **What it is:** Making sure our code knows exactly what kind of data to expect (like a word vs. a number) so it doesn't crash.
- **How we measured it:** By checking the code for errors or places where developers forced the computer to guess the data type.
- **Baseline numbers:** We found 1,417 spots where the code forces a data type.
- **Specific weakpoints:** The code pulls data from the database but doesn't check what type it is, forcing developers to manually add bypasses everywhere.
- **Severity/Impact:** High. If a database column changes, the code won't warn us; it will just crash while users are working.
- **How to fix them:** Add a simple rule layer that automatically matches the database data to the right types before it hits the main code.

## 2. Bundle Size
- **What it is:** The size of the code files users have to download to load the app in their browser.
- **How we measured it:** By looking at the file sizes of the website's code chunks.
- **Baseline numbers:** The total size is 2.1 MB, and 95% of that is stuffed into a single massive file.
- **Specific weakpoints:** The app forces people to download heavy features (like code highlighters and emoji pickers) as soon as they open the page, even if they aren't using them. 
- **Severity/Impact:** High impact on initial loading speed, making the app feel slow and bloated from the first click.
- **How to fix them:** Split the single massive file into pieces and only load heavy features when the user actually needs them (lazy-loading).

## 3. API Response Time
- **What it is:** How long it takes our server back-end to answer when the app asks for data.
- **How we measured it:** By timing the slowest 5% of data requests our server receives.
- **Baseline numbers:** The main dashboard takes about 68 milliseconds, but loading the issues list takes over 200 milliseconds.
- **Specific weakpoints:** The server is fetching way too much unnecessary data—like sending the full text of every document just to show a simple list of titles. It's also doing tasks one-by-one instead of all at the same time.
- **Severity/Impact:** Medium to High. The app already feels sluggish, and it will get painfully slow as we add more users and data.
- **How to fix them:** Only fetch the minimal data needed for the list screen, and run independent server tasks at the exact same time (in parallel).

## 4. Database Query Efficiency
- **What it is:** How hard the database has to work to handle a single action from a single user.
- **How we measured it:** By counting how many times the database is contacted when a user just loads one page.
- **Baseline numbers:** Loading the main page contacts the database 22 separate times.
- **Specific weakpoints:** Every single time a user clicks, the database is hammered with duplicate checks, like making sure they are logged in or updating their "last seen" timer. That's 11 of the 22 queries just for background login checks.
- **Severity/Impact:** Medium now, High risk later. Hitting the database 22 times per page load per person will take down the system when we get a surge of users.
- **How to fix them:** Combine the duplicate login checks into a single trip, and only update the "last seen" timer once every minute.

## 5. Test Coverage
- **What it is:** How much of our code is actually proven to work by automated test robots.
- **How we measured it:** By running our testing tools and checking which features are actually verified.
- **Baseline numbers:** Out of 1,333 written tests, only 34% are actually running right now.
- **Specific weakpoints:** We have massive test blind spots. Government login paths and core features have zero automated tests. Worse, entire test suites are broken because of mismatched code file formats.
- **Severity/Impact:** High. Without automated tests, any minor update we make to the code could accidentally break user logins or save buttons, and we wouldn't know until users complain.
- **How to fix them:** Fix the broken test setups so they run properly, and write brand new tests for the most critical features like logging in.

## 6. Runtime Error Handling
- **What it is:** How the app behaves when something goes wrong or breaks under the hood.
- **How we measured it:** By checking hidden developer console errors and testing what happens during connection drops.
- **Baseline numbers:** We found 6 different types of "silent" failures where the app breaks but doesn't tell anyone.
- **Specific weakpoints:** The app swallows important errors. For instance, if the database connection blips while a user is typing, the app doesn't retry or warn the user—it just secretly loses their work permanently. A major crash leaves users staring at a blank screen.
- **Severity/Impact:** Critical. Users permanently losing their work is the worst possible experience.
- **How to fix them:** Add "safety nets" (error boundaries) that catch crashes so the app doesn't blank out, and make sure the app loudly warns and retries if saving data fails.

## 7. Accessibility
- **What it is:** Making sure people with disabilities (like vision impairment or those using screen-reading software) can comfortably use the app.
- **How we measured it:** By using digital scanning tools (Lighthouse) and checking standard government accessibility rules.
- **Baseline numbers:** While many pages score well (90+), we found 6 critical color contrast failures.
- **Specific weakpoints:** Light gray text blends into dark gray backgrounds, making it tough to read. Important buttons don't have invisible text labels for screen readers. Some menus physically cannot be used with just the arrow keys.
- **Severity/Impact:** High. The app claims to be government accessibility-compliant, but these issues mean it isn't. It actively locks out users who rely on assistive tools.
- **How to fix them:** Darken or brighten text colors to pass readability standards, add descriptive invisible tags to buttons, and ensure all menus can be controlled by a keyboard.
