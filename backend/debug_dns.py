import socket
import sys

def debug_connection(host, port=5432):
    print(f"--- Diagnostic Report ---")
    print(f"Target Host: {host}")
    print(f"Target Port: {port}")
    
    # 1. Test DNS Resolution
    print("\n[1/3] Testing DNS Resolution (IPv4 - AF_INET)...")
    try:
        addr_info = socket.getaddrinfo(host, port, family=socket.AF_INET)
        print(f"SUCCESS (IPv4): Resolved {host}")
    except Exception as e:
        print(f"FAILURE (IPv4): {e}")

    print("\n[2/3] Testing DNS Resolution (IPv6 - AF_INET6)...")
    try:
        addr_info = socket.getaddrinfo(host, port, family=socket.AF_INET6)
        print(f"SUCCESS (IPv6): Resolved {host} to:")
        for res in addr_info:
            print(f"  - {res[4][0]}")
    except Exception as e:
        print(f"FAILURE (IPv6): {e}")

    # 2. Test Socket Connection (Network level)
    print("\n[2/2] Testing Network Connectivity (Socket)...")
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(5)
        s.connect((host, port))
        print(f"SUCCESS: Port {port} is open and reachable.")
        s.close()
    except Exception as e:
        print(f"FAILURE: Could not connect to {host}:{port}")
        print(f"Error: {e}")

if __name__ == "__main__":
    target_host = "db.uwzosvzynnpbxpnwqgkm.supabase.co"
    debug_connection(target_host)
