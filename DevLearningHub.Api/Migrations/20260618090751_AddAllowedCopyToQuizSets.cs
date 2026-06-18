using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DevLearningHub.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAllowedCopyToQuizSets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "allowed_copy",
                table: "quiz_sets",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "allowed_copy",
                table: "quiz_sets");
        }
    }
}
