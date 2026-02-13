widok inwestycji fron do zmiany
dodanie tenstack tables
virtual lists + pagination
Hide nowa transakcja for non authenticated users
Replace reference data dropdowns with searchable combobox — sidebar fetches all users/investments/categories upfront with `pagination: false`. This won't scale past ~100-200 records. Switch to a search-as-you-type combobox with server-side filtering (debounced Payload query on keystroke) for: workers, investments, cash registers, other categories.
