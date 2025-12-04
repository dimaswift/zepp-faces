import datetime
import struct
import pytz
from astral import LocationInfo
from astral.sun import sun

# --- CONFIGURATION ---
# 1. Location Settings (Example: Vienna, Austria)
LATITUDE = 52.9821627
LONGITUDE = 36.1407290
TIMEZONE = "Europe/Moscow"

# 2. Date Range
START_DATE = datetime.date(2025, 12, 21)
DAYS_TO_CALCULATE = 365  # Calculate for 2 years

# 3. Custom Epoch (The offset to subtract)
# This allows the numbers to fit into 32-bit integers if you are dealing 
# with years far in the future, or simply to keep numbers small.
# Using 0 uses standard Unix Epoch (1970-01-01).
# Example: Set to the timestamp of 2024-01-01 to make indices 0-based from start date.
CUSTOM_EPOCH = 0 
# CUSTOM_EPOCH = 1704067200 # Example: 2024-01-01 00:00:00 UTC

# 4. Output File
OUTPUT_FILENAME = "/sun_data.bin"


def generate_sun_data():
    # Setup Location
    city = LocationInfo("Custom", "Region", TIMEZONE, LATITUDE, LONGITUDE)
    tz_info = pytz.timezone(TIMEZONE)
    
    # Open file for writing binary data
    with open(OUTPUT_FILENAME, "wb") as f:
        print(f"Generating data for {DAYS_TO_CALCULATE} days starting {START_DATE}...")
        
        current_date = START_DATE
        for i in range(DAYS_TO_CALCULATE):
            try:
                # Calculate sun info for the specific day
                # We typically calculate for noon to avoid edge cases with timezone shifts at midnight
                s = sun(city.observer, date=current_date, tzinfo=tz_info)
                
                # Get Sunrise and Sunset
                rise = s['sunrise']
                sett = s['sunset']
                
                # Convert to Unix Timestamp (seconds)
                rise_ts = int(rise.timestamp())
                set_ts = int(sett.timestamp())
                
                # Apply Offset
                stored_rise = rise_ts - CUSTOM_EPOCH
                stored_set = set_ts - CUSTOM_EPOCH
                
                print(str(stored_rise) + ",")
                print(str(stored_set) + ",")

                # Validate 32-bit fit (Signed: -2GB to 2GB, Unsigned: 0 to 4GB)
                # Standard Unix timestamps fit in unsigned 32-bit until year 2106.
                if not (0 <= stored_rise <= 4294967295):
                    print(f"Warning: Rise timestamp for {current_date} overflows 32-bit unsigned integer!")
                
                # Pack into binary (Little Endian '<' unsigned int 'I')
                # Use 'i' for signed int if you expect negative numbers relative to your epoch
                # Each entry is 8 bytes total (4 bytes rise + 4 bytes set)
                f.write(struct.pack('<I', stored_rise))
                f.write(struct.pack('<I', stored_set))
                
            except Exception as e:
                print(f"Error calculating for {current_date}: {e}")
                # Write zeros or placeholders on error to maintain index alignment
                f.write(struct.pack('<II', 0, 0))

            # Move to next day
            current_date += datetime.timedelta(days=1)

    print(f"Done! Data written to {OUTPUT_FILENAME}")
    print(f"Total size: {DAYS_TO_CALCULATE * 8} bytes")

if __name__ == "__main__":
    generate_sun_data()