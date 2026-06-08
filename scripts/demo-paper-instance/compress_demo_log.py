"""
Compression script for demo log files
Compresses demo log YAML and outputs to fallback/logs directory
"""
import gzip
import shutil
import os

def compress_demo_log():
    # Get the script directory and construct paths relative to it
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = script_dir
    fallback_logs_dir = os.path.join(os.path.dirname(os.path.dirname(script_dir)), 'fallback', 'logs')
    
    input_file = os.path.join(base_dir, '00000001-0000-0000-0000-000000000001xes.yaml')
    output_file = os.path.join(fallback_logs_dir, '00000001-0000-0000-0000-000000000001.xes.yaml.gz')
    
    if not os.path.exists(input_file):
        print(f"Error: Input file not found: {input_file}")
        return False
    
    print(f"Compressing {input_file}...")
    
    with open(input_file, 'rb') as f_in:
        with gzip.open(output_file, 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)
    
    # Get file sizes
    original_size = os.path.getsize(input_file)
    compressed_size = os.path.getsize(output_file)
    ratio = (1 - compressed_size / original_size) * 100
    
    print(f"Compression complete!")
    print(f"Original size: {original_size:,} bytes")
    print(f"Compressed size: {compressed_size:,} bytes")
    print(f"Compression ratio: {ratio:.1f}%")
    print(f"Output: {output_file}")
    
    return True

if __name__ == '__main__':
    compress_demo_log()
