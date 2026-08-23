#!/usr/bin/env python3
"""
CTF / crackme solver template.
Fill in the extraction or solve logic discovered during reverse analysis.
"""


def extract():
    """Extract challenge data from the target (strings, assets, constants)."""
    raise NotImplementedError("Fill in data extraction logic.")


def solve(data):
    """Reverse the verification logic and compute the flag / answer."""
    raise NotImplementedError("Fill in solve logic.")


if __name__ == "__main__":
    data = extract()
    result = solve(data)
    print(result)
