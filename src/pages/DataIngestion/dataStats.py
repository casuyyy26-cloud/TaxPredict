# dataStats.py

def countBy(array, key):
    counts = {}
    for item in array:
        # Use dict.get() safely, defaulting to '—' if key is missing
        val = item.get(key) if item.get(key) else '—'
        counts[val] = counts.get(val, 0) + 1
    
    # Returns a list of tuples: [('Value', Count), ...] sorted descending by count
    return sorted(counts.items(), key=lambda x: x[1], reverse=True)


def countByBarangayAndSize(rows):
    counts = {}
    
    for row in rows:
        barangay = row.get('barangay') if row.get('barangay') else '—'
        size = row.get('business_size') if row.get('business_size') else '—'

        if barangay not in counts:
            counts[barangay] = {
                'barangay': barangay,
                'MICRO': 0,
                'SMALL': 0,
                'MEDIUM': 0,
                'LARGE': 0,
                'total': 0,
            }

        if size in ['MICRO', 'SMALL', 'MEDIUM', 'LARGE']:
            counts[barangay][size] += 1
        counts[barangay]['total'] += 1

    # Returns list of dictionaries sorted alphabetically by barangay
    return sorted(counts.values(), key=lambda x: x['barangay'])