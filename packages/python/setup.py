from setuptools import setup, find_packages

setup(
    name="ashwingopalsamy",
    version="1.0.0",
    description="Official Python SDK for Ashwin Gopalsamy's developer API, profile, notes, and search index",
    long_description=open("README.md", encoding="utf-8").read(),
    long_description_content_type="text/markdown",
    author="Ashwin Gopalsamy",
    author_email="hello@ashwingopalsamy.in",
    url="https://ashwingopalsamy.in/developers",
    project_urls={
        "Homepage": "https://ashwingopalsamy.in/developers",
        "Documentation": "https://ashwingopalsamy.in/developers",
        "Repository": "https://github.com/ashwingopalsamy/site",
        "OpenAPI": "https://ashwingopalsamy.in/openapi.json",
    },
    packages=find_packages(),
    license="MIT",
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
    ],
    python_requires=">=3.8",
)
