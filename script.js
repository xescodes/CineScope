// TMDb API configuration
const API_KEY = '63d75d14e8ad3052d6a70ff0e7c28729';

// Validate API key
if (!API_KEY) {
    console.error('Please set your TMDb API key');
    document.getElementById('results').innerHTML = `
        <div class="error-message">
            <p>Please configure your TMDb API key to use this application.</p>
            <p class="error-details">Steps to get an API key:</p>
            <ol style="text-align: left; margin-top: 10px;">
                <li>Go to <a href="https://www.themoviedb.org/" target="_blank">TMDb</a></li>
                <li>Create an account or sign in</li>
                <li>Go to your profile settings</li>
                <li>Click on "API" in the left sidebar</li>
                <li>Request an API key (choose "Developer" option)</li>
                <li>Copy your API key and replace 'YOUR_API_KEY' in script.js</li>
            </ol>
        </div>
    `;
}

const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// Wikimedia API configuration
const WIKI_API_URL = 'https://en.wikipedia.org/w/api.php';

// DOM elements
const searchInput = document.getElementById('searchInput');
const genreSelect = document.getElementById('genreSelect');
const searchButton = document.getElementById('searchButton');
const resultsBody = document.getElementById('resultsBody');

// Sorting state
let currentSort = {
    column: null,
    direction: 'asc'
};

// Initialize the application
async function initializeApp() {
    try {
        // Load genres
        await loadGenres();
        // Setup sorting functionality
        setupSorting();
    } catch (error) {
        console.error('Error initializing app:', error);
    }
}

// Setup sorting functionality
function setupSorting() {
    const sortableHeaders = document.querySelectorAll('th.sortable');
    sortableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const column = header.dataset.sort;
            
            // Update sorting direction
            if (currentSort.column === column) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.direction = 'asc';
            }
            
            // Update visual indicators
            sortableHeaders.forEach(h => {
                h.classList.remove('asc', 'desc');
                if (h.dataset.sort === column) {
                    h.classList.add(currentSort.direction);
                }
            });
            
            // Sort and redisplay results
            const rows = Array.from(resultsBody.children);
            if (rows.length > 0) {
                sortResults(rows);
            }
        });
    });
}

// Sort results
function sortResults(rows) {
    const sortedRows = rows.sort((a, b) => {
        let aValue, bValue;
        
        switch (currentSort.column) {
            case 'title':
                aValue = a.querySelector('.movie-title').textContent;
                bValue = b.querySelector('.movie-title').textContent;
                break;
            case 'rating':
                aValue = parseFloat(a.querySelector('.movie-rating').textContent.split('★')[1]);
                bValue = parseFloat(b.querySelector('.movie-rating').textContent.split('★')[1]);
                break;
            case 'year':
                aValue = parseInt(a.children[4].textContent) || 0;
                bValue = parseInt(b.children[4].textContent) || 0;
                break;
        }
        
        // Handle ascending/descending
        if (currentSort.direction === 'asc') {
            return aValue > bValue ? 1 : -1;
        } else {
            return aValue < bValue ? 1 : -1;
        }
    });
    
    // Clear and re-append sorted rows
    resultsBody.innerHTML = '';
    sortedRows.forEach(row => resultsBody.appendChild(row));
}

// Load genres
async function loadGenres() {
    try {
        const response = await fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}`);
        const data = await response.json();
        
        if (data.genres) {
            data.genres.forEach(genre => {
                const option = document.createElement('option');
                option.value = genre.id;
                option.textContent = genre.name;
                genreSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading genres:', error);
    }
}

// Search function
async function performSearch() {
    const query = searchInput.value.trim();
    const genreId = genreSelect.value;
    
    if (!query && !genreId) return;

    try {
        // Always start with discover endpoint when genre is selected
        let url = `${BASE_URL}/discover/movie?api_key=${API_KEY}`;
        
        // Add genre filter if selected
        if (genreId) {
            url += `&with_genres=${genreId}`;
        }
        
        // Add text search if provided
        if (query) {
            url += `&with_text_query=${encodeURIComponent(query)}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data || !data.results) {
            console.error('Invalid API response:', data);
            throw new Error('Invalid API response format');
        }
        
        // Filter results by text query if provided
        let filteredResults = data.results;
        if (query) {
            const searchTerms = query.toLowerCase().split(' ');
            filteredResults = data.results.filter(movie => {
                const movieText = `${movie.title} ${movie.overview || ''}`.toLowerCase();
                return searchTerms.every(term => movieText.includes(term));
            });
        }
        
        // Fetch additional details for each movie
        const moviesWithDetails = await Promise.all(
            filteredResults.map(async (movie) => {
                const detailsResponse = await fetch(
                    `${BASE_URL}/movie/${movie.id}?api_key=${API_KEY}`
                );
                const details = await detailsResponse.json();
                return {
                    ...movie,
                    genres: details.genres || []
                };
            })
        );
        
        displayResults(moviesWithDetails);
    } catch (error) {
        console.error('Error fetching movies:', error);
        resultsBody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="error-message">
                        <p>Error fetching movies. Please try again.</p>
                        <p class="error-details">${error.message}</p>
                    </div>
                </td>
            </tr>
        `;
    }
}

// Function to fetch plot from Wikipedia
async function fetchMoviePlot(title, year) {
    try {
        const searchQuery = `${title} (${year}) film`;
        const params = new URLSearchParams({
            action: 'query',
            format: 'json',
            list: 'search',
            srsearch: searchQuery,
            srlimit: 1,
            origin: '*'
        });

        const response = await fetch(`${WIKI_API_URL}?${params}`);
        const data = await response.json();

        if (data.query && data.query.search && data.query.search.length > 0) {
            const pageId = data.query.search[0].pageid;
            const pageTitle = data.query.search[0].title;
            const extractParams = new URLSearchParams({
                action: 'query',
                format: 'json',
                prop: 'extracts',
                exintro: true,
                explaintext: true,
                pageids: pageId,
                origin: '*'
            });

            const extractResponse = await fetch(`${WIKI_API_URL}?${extractParams}`);
            const extractData = await extractResponse.json();

            if (extractData.query && extractData.query.pages && extractData.query.pages[pageId]) {
                const extract = extractData.query.pages[pageId].extract;
                // Check if the extract contains relevant movie information
                if (extract && extract.toLowerCase().includes(title.toLowerCase())) {
                    return {
                        text: extract,
                        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`
                    };
                }
            }
        }
        return {
            text: 'Article not available',
            url: null
        };
    } catch (error) {
        console.error('Error fetching plot:', error);
        return {
            text: 'Error loading information',
            url: null
        };
    }
}

// Update displayResults function
function displayResults(movies) {
    const resultsTable = document.getElementById('results');
    const tbody = document.getElementById('resultsBody');
    tbody.innerHTML = '';

    movies.forEach(movie => {
        const row = document.createElement('tr');
        
        // Poster cell with clickable image
        const posterCell = document.createElement('td');
        if (movie.poster_path) {
            const posterLink = document.createElement('a');
            posterLink.href = `https://image.tmdb.org/t/p/original${movie.poster_path}`;
            posterLink.target = '_blank';
            posterLink.title = `View ${movie.title} poster in full size`;
            
            const posterImg = document.createElement('img');
            posterImg.src = `https://image.tmdb.org/t/p/w200${movie.poster_path}`;
            posterImg.alt = `${movie.title} poster`;
            posterImg.className = 'movie-poster';
            
            posterLink.appendChild(posterImg);
            posterCell.appendChild(posterLink);
        } else {
            posterCell.textContent = 'No poster available';
        }
        row.appendChild(posterCell);

        // Title cell
        const titleCell = document.createElement('td');
        const titleElement = document.createElement('div');
        titleElement.className = 'movie-title';
        titleElement.dataset.id = movie.id;
        titleElement.textContent = movie.title;
        titleCell.appendChild(titleElement);
        row.appendChild(titleCell);

        // Genres cell
        const genresCell = document.createElement('td');
        const genresList = document.createElement('div');
        genresList.className = 'movie-genres';
        movie.genres.forEach(genre => {
            const genreSpan = document.createElement('span');
            genreSpan.className = 'genre-tag';
            genreSpan.textContent = genre.name;
            genresList.appendChild(genreSpan);
        });
        genresCell.appendChild(genresList);
        row.appendChild(genresCell);

        // Rating cell
        const ratingCell = document.createElement('td');
        const ratingSpan = document.createElement('span');
        ratingSpan.className = 'movie-rating';
        ratingSpan.textContent = `★ ${movie.vote_average.toFixed(1)}`;
        ratingCell.appendChild(ratingSpan);
        row.appendChild(ratingCell);

        // Year cell
        const yearCell = document.createElement('td');
        yearCell.textContent = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
        row.appendChild(yearCell);

        // Overview cell
        const overviewCell = document.createElement('td');
        const overviewElement = document.createElement('div');
        overviewElement.className = 'movie-overview';
        overviewElement.dataset.id = movie.id;
        overviewElement.textContent = movie.overview || 'No overview available.';
        overviewCell.appendChild(overviewElement);
        row.appendChild(overviewCell);

        // Plot cell
        const plotCell = document.createElement('td');
        const plotElement = document.createElement('div');
        plotElement.className = 'movie-plot';
        plotElement.dataset.title = movie.title;
        plotElement.dataset.year = yearCell.textContent;
        plotElement.textContent = 'Loading plot...';
        plotCell.appendChild(plotElement);
        row.appendChild(plotCell);

        tbody.appendChild(row);
    });

    // Load plots and setup click handlers for each movie
    document.querySelectorAll('.movie-plot, .movie-title, .movie-overview').forEach(element => {
        const movieId = element.dataset.id;
        if (movieId) {
            element.addEventListener('click', () => {
                window.open(`https://www.themoviedb.org/movie/${movieId}`, '_blank');
            });
            element.style.cursor = 'pointer';
        }
    });

    // Load plots for each movie
    document.querySelectorAll('.movie-plot').forEach(plotElement => {
        const title = plotElement.dataset.title;
        const year = plotElement.dataset.year;
        if (year !== 'N/A') {
            fetchMoviePlot(title, year).then(plotData => {
                if (plotData.url) {
                    plotElement.innerHTML = `
                        <a href="${plotData.url}" target="_blank" class="movie-plot-link">
                            ${plotData.text}
                        </a>
                    `;
                } else {
                    plotElement.textContent = plotData.text;
                }
            });
        } else {
            plotElement.textContent = 'Year not available for plot search.';
        }
    });
}

// Load genres on page load
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const genreSelect = document.getElementById('genreSelect');
    const resultsTable = document.getElementById('results');
    const resultsBody = document.getElementById('resultsBody');

    // Initialize the application
    initializeApp();
    
    // Add event listeners
    searchButton.addEventListener('click', () => performSearch());
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
}); 