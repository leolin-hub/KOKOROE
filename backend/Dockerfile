# 後端 image，多階段建置：第一階段有 JDK 與 Maven 快取，第二階段只留 JRE 和拆好層的 jar。
#
# 建置：docker build -t kokoroe-backend backend
# 正式環境由 .github/workflows/deploy.yml 建成 arm64（Oracle Cloud 的 Ampere VM），推到 GHCR。

# ---- 建置階段 ----
FROM eclipse-temurin:25-jdk AS build
WORKDIR /workspace

# 先只複製 Maven 設定並下載依賴：pom.xml 沒變時這一層會被快取，改程式碼不用重新下載整個 .m2。
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN ./mvnw --batch-mode --no-transfer-progress dependency:go-offline

COPY src/ src/
# 測試在 CI 已經跑過（deploy.yml 只在 CI 成功後才觸發），這裡跳過以免要在建置環境裡起 Testcontainers。
# 打包後把 fat jar 拆成依賴、loader、應用程式幾層。依賴很少變，放在前面的層，
# 平常只改程式碼時，部署只需要重新下載最後那一小層。
RUN ./mvnw --batch-mode --no-transfer-progress package -DskipTests \
 && mv target/kokoroe-backend-*.jar app.jar \
 && java -Djarmode=tools -jar app.jar extract --layers --launcher --destination extracted

# ---- 執行階段 ----
FROM eclipse-temurin:25-jre

# 不用 root 跑：就算應用程式被打穿，攻擊者在容器裡也只是一般使用者。
RUN groupadd --system --gid 10001 kokoroe \
 && useradd --system --uid 10001 --gid kokoroe --no-create-home --shell /usr/sbin/nologin kokoroe

WORKDIR /app
COPY --from=build /workspace/extracted/dependencies/ ./
COPY --from=build /workspace/extracted/spring-boot-loader/ ./
COPY --from=build /workspace/extracted/snapshot-dependencies/ ./
COPY --from=build /workspace/extracted/application/ ./

USER kokoroe:kokoroe
EXPOSE 8080

# MaxRAMPercentage：JVM 預設只拿容器記憶體上限的 1/4 當 heap，太保守。
# compose 給容器 2 GB，這裡讓 heap 用到六成。剩下的要留給 /tmp 的 tmpfs（上傳暫存檔也算容器記憶體）、
# metaspace、執行緒堆疊、Tomcat 與 AWS SDK 的緩衝區。
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60 -XX:+ExitOnOutOfMemoryError"

ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
