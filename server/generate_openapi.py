import json
import os
from main import app


def generate_openapi():
    # app.openapi() generates the OpenAPI schema as a dictionary
    openapi_schema = app.openapi()

    output_path = os.path.join(os.path.dirname(__file__), "openapi.json")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(openapi_schema, f, indent=2)

    print(f"OpenAPI spec successfully saved to: {output_path}")


if __name__ == "__main__":
    generate_openapi()
