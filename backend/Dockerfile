FROM eclipse-temurin:21-jdk-noble@sha256:57424b1d8eca9c4cf8a4fe226207027911f08d6758628891bf59fcfb53777029 AS build
WORKDIR /workspace
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw
COPY src src
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -ntp -DskipTests package

FROM eclipse-temurin:21-jre-noble@sha256:cd35bb33859641c5374415826a5951845104093eaa401cbe9d3d9023444f1c13
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 studio \
    && useradd --system --uid 10001 --gid studio --home-dir /app studio \
    && mkdir -p /app /data/material && chown -R studio:studio /app /data/material
WORKDIR /app
COPY --from=build --chown=studio:studio /workspace/target/material-studio-api-*.jar app.jar
USER studio
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
